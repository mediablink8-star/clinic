/**
 * SMS fallback service for Voice AI calls.
 * Sends directly via Twilio.
 */
const { sendSms } = require('./twilioService');
const prisma = require('./prisma');

async function triggerSmsFallback(clinic, phone, message, missedCallId) {
    try {
        const result = await sendSms({ to: phone, body: message });
        if (!result.success) throw new Error(result.error || 'Twilio send failed');
        prisma.clinic.update({
            where: { id: clinic.id },
            data: { messageCredits: { decrement: 1 } }
        }).catch(err => console.warn(`[SMS Fallback] credit decrement failed: ${err.message}`));
        return { success: true };
    } catch (err) {
        console.warn(`[SMS Fallback] Failed for ${phone}: ${err.message}`);
        return { success: false, reason: err.message };
    }
}

module.exports = { triggerSmsFallback };
