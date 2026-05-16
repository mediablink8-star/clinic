const twilio = require('twilio');
const prisma = require('./prisma');
const { incrementSmsUsage } = require('./usageService');
const AppError = require('../errors/AppError');

function getClient() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    return twilio(accountSid, authToken);
}

function getSender() {
    return process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_ALPHA_SENDER_ID || '';
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
        const message = await client.messages.create({
            to,
            from: sender,
            body,
        });
        console.info(`[Twilio] SMS sent: ${message.sid} -> ***${to.slice(-4)}`);
        return { success: true, sid: message.sid };
    } catch (err) {
        console.warn(`[Twilio] Failed: ${err.message}`);
        return { success: false, error: err.message };
    }
}

async function sendSmsWithTracking({ to, body, clinicId }) {
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
