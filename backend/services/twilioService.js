const twilio = require('twilio');
const prisma = require('./prisma');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');
const AppError = require('../errors/AppError');

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

async function sendSms({ to, body }) {
    const client = getClient();
    if (!client) {
        console.error('[Twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
        return { success: false, error: 'Twilio not configured' };
    }

    const sender = getSender();
    if (!sender) {
        console.error('[Twilio] No sender configured');
        return { success: false, error: 'No Twilio sender configured. Set TWILIO_PHONE_NUMBER or TWILIO_ALPHA_SENDER_ID.' };
    }

    try {
        if (isAlphanumericSender(sender) && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
            // Direct alpha sender (works in supported countries like Greece)
            const message = await client.messages.create({
                to,
                from: sender,
                body,
                statusCallback: `${process.env.BACKEND_API_URL || ''}/api/webhook/sms-status`,
            });
            console.info(`[Twilio] SMS sent (alpha): ${message.sid} -> ***${to.slice(-4)} [${sender}]`);
            return { success: true, sid: message.sid };
        }

        const message = await client.messages.create({
            to,
            from: isAlphanumericSender(sender) ? undefined : sender,
            messagingServiceSid: isAlphanumericSender(sender) ? process.env.TWILIO_MESSAGING_SERVICE_SID : undefined,
            body,
            ...(isAlphanumericSender(sender) && { statusCallback: `${process.env.BACKEND_API_URL || ''}/api/webhook/sms-status` }),
        });

        console.info(`[Twilio] SMS sent: ${message.sid} -> ***${to.slice(-4)}`);
        return { success: true, sid: message.sid };
    } catch (err) {
        console.warn(`[Twilio] Failed: ${err.message}`);
        return { success: false, error: err.message };
    }
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
            return { success: false, error: 'Monthly SMS limit reached (500)' };
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
            console.warn(`[Twilio] Credit deduction failed for clinic ${clinicId}: insufficient credits`);
        } else {
            console.warn(`[Twilio] Credit/usage tracking failed for clinic ${clinicId}: ${err.message}`);
        }
    }

    return result;
}

module.exports = { sendSms, sendSmsWithTracking };
