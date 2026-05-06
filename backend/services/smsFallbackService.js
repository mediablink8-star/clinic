/**
 * SMS fallback service for Voice AI calls.
 * Uses sendManagedSms for consistent credit deduction and logging.
 */
const { sendManagedSms } = require('./messagingService');

async function triggerSmsFallback(clinic, phone, message, missedCallId) {
    try {
        await sendManagedSms({
            clinicId: clinic.id,
            clinic,
            eventType: 'voice.sms_fallback',
            payload: { phone, message, missedCallId, clinicId: clinic.id },
            logType: 'SMS',
        });
        return { success: true };
    } catch (err) {
        console.warn(`[SMS Fallback] Failed for ${phone}: ${err.message}`);
        return { success: false, reason: err.message };
    }
}

module.exports = { triggerSmsFallback };
