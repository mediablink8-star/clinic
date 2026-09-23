const twilio = require('twilio');
const prisma = require('./prisma');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');

function getClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    return twilio(accountSid, authToken);
}

/**
 * Get the sender for outbound SMS.
 * Supports both phone numbers (+1234567890) and alphanumeric sender IDs (e.g. "ClinicFlow").
 * Alphanumeric sender IDs are supported in many countries but NOT in the US/Canada.
 */
function getSender() {
    return process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_ALPHA_SENDER_ID || '';
}

/**
 * Check if a sender is an alphanumeric sender ID (not a phone number).
 */
function isAlphanumericSender(sender) {
    return sender && !sender.startsWith('+') && !/^\d+$/.test(sender);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sendSms({ to, body }) {
    const client = getClient();
    if (!client) {
        logger.error('Twilio TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
        return { success: false, error: 'Twilio not configured' };
    }

    const sender = getSender();
    if (!sender) {
        logger.error('Twilio No sender configured');
        return { success: false, error: 'No Twilio sender configured. Set TWILIO_PHONE_NUMBER or TWILIO_ALPHA_SENDER_ID.' };
    }

    // Retry up to 3 times on transient errors (network, 5xx, timeouts)
    const MAX_ATTEMPTS = 3;
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            let message;
            if (isAlphanumericSender(sender) && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
                message = await client.messages.create({
                    to,
                    from: sender,
                    body,
                    statusCallback: `${process.env.BACKEND_API_URL || ''}/api/webhook/sms-status`,
                });
            } else {
                message = await client.messages.create({
                    to,
                    from: isAlphanumericSender(sender) ? undefined : sender,
                    messagingServiceSid: isAlphanumericSender(sender) ? process.env.TWILIO_MESSAGING_SERVICE_SID : undefined,
                    body,
                    ...(isAlphanumericSender(sender) && { statusCallback: `${process.env.BACKEND_API_URL || ''}/api/webhook/sms-status` }),
                });
            }
            logger.info('Twilio SMS sent', { sid: message.sid, phoneTail: to.slice(-4), sender, attempt });
            return { success: true, sid: message.sid };
        } catch (err) {
            lastError = err;
            const code = err.code || 0;
            // Don't retry on permanent errors: invalid number (21211), unsubscribed (21610), etc.
            const permanent = [21211, 21214, 21610, 21408, 21606, 30007, 30008].includes(code);
            if (permanent || attempt === MAX_ATTEMPTS) {
                logger.warn('Twilio SMS failed', { err: err.message, code, to: to.slice(-4), attempt });
                return { success: false, error: err.message, code };
            }
            logger.warn(`Twilio SMS attempt ${attempt} failed — retrying`, { err: err.message, code });
            await sleep(500 * Math.pow(2, attempt - 1)); // 500ms, 1s
        }
    }
    return { success: false, error: lastError?.message || 'Unknown error' };
}

async function sendSmsWithTracking({ to, body, clinicId }) {
    // Reserve the credit and usage slot BEFORE calling the provider. This
    // closes the race where concurrent sends could all pass the preflight
    // check and only one would be charged after delivery.
    let reservationId = null;

    try {
        const { limit, dailyLimit } = await assertWithinSmsLimit(clinicId);

        const reservation = await prisma.$transaction(async (tx) => {
            const { ensureMonthlyUsageWindow } = require('./usageService');
            await ensureMonthlyUsageWindow(clinicId, tx);

            const result = await tx.clinic.updateMany({
                where: {
                    id: clinicId,
                    messageCredits: { gt: 0 },
                    smsCount: { lt: limit },
                    dailyUsedCount: { lt: dailyLimit },
                },
                data: {
                    messageCredits: { decrement: 1 },
                    smsCount: { increment: 1 },
                    dailyUsedCount: { increment: 1 },
                },
            });

            if (result.count === 0) {
                throw new AppError('USAGE_LIMIT_REACHED', 'SMS limit or message credits reached', 429);
            }

            const log = await tx.messageLog.create({
                data: {
                    clinicId,
                    type: 'SMS',
                    status: 'PENDING',
                    cost: 1,
                },
            });

            return log.id;
        });

        reservationId = reservation;
    } catch (err) {
        if (err.code === 'USAGE_LIMIT_REACHED') {
            return { success: false, error: err.message };
        }

        logger.error('SMS reservation failed', { clinicId, error: err.message });
        return { success: false, error: 'Unable to reserve SMS credit' };
    }

    const result = await sendSms({ to, body });

    if (result.success) {
        try {
            await prisma.messageLog.update({
                where: { id: reservationId },
                data: { status: 'SENT' },
            });
        } catch (err) {
            // The provider already accepted the SMS and the reservation is
            // already charged. Keep the successful provider result, but log
            // the accounting discrepancy for operational reconciliation.
            logger.error('SMS sent but delivery log update failed', {
                clinicId,
                reservationId,
                sid: result.sid,
                error: err.message,
            });
        }

        return result;
    }

    // Provider failure: refund the reserved credit. We intentionally keep
    // usage counters consumed so repeated provider failures cannot bypass
    // monthly/daily caps.
    try {
        await prisma.$transaction(async (tx) => {
            await tx.clinic.update({
                where: { id: clinicId },
                data: { messageCredits: { increment: 1 } },
            });

            await tx.messageLog.update({
                where: { id: reservationId },
                data: {
                    status: 'FAILED',
                    error: result.error || 'SMS provider failed',
                },
            });
        });
    } catch (err) {
        logger.error('SMS provider failed and credit refund/logging failed', {
            clinicId,
            reservationId,
            providerError: result.error,
            error: err.message,
        });
    }

    return result;
}

module.exports = { sendSms, sendSmsWithTracking };
