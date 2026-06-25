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
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { messageCredits: true, smsCount: true, smsMonthlyLimit: true, dailyUsedCount: true, dailyMessageCap: true, lastResetDate: true, lastResetDay: true, timezone: true },
    });
    if (!clinic || clinic.messageCredits <= 0) {
        return { success: false, error: 'Insufficient message credits' };
    }

    // Check monthly + daily limits BEFORE sending
    try {
        await assertWithinSmsLimit(clinicId);
    } catch (err) {
        if (err.code === 'USAGE_LIMIT_REACHED') {
            return { success: false, error: 'Monthly SMS limit reached' };
        }
        return { success: false, error: 'SMS rate limit exceeded' };
    }

    const result = await sendSms({ to, body });
    if (!result.success) return result;

    try {
        await prisma.$transaction(async (tx) => {
            const updated = await tx.clinic.updateMany({
                where: { id: clinicId, messageCredits: { gt: 0 } },
                data: { messageCredits: { decrement: 1 } },
            });
            if (updated.count === 0) {
                throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
            }
            await incrementSmsUsage(clinicId, tx);
            await tx.messageLog.create({
                data: {
                    clinicId,
                    type: 'SMS',
                    status: 'SENT',
                    cost: 1,
                },
            });
        });
    } catch (err) {
        if (err.code === 'INSUFFICIENT_CREDITS') {
            logger.warn('Twilio Credit deduction failed', { clinicId, reason: 'insufficient credits' });
        } else {
            logger.warn('Twilio Credit/usage tracking failed', { clinicId, error: err.message });
        }
    }

    return result;
}

module.exports = { sendSms, sendSmsWithTracking };
