const { sendSmsWithTracking } = require('./twilioService');
const logger = require('../utils/logger');

async function triggerSmsFallback(clinic, phone, message, missedCallId) {
    try {
        const result = await sendSmsWithTracking({ to: phone, body: message, clinicId: clinic.id });
        if (!result.success) throw new Error(result.error || 'Twilio send failed');
        return { success: true };
    } catch (err) {
        logger.warn('SMS Fallback Failed', { phone, error: err.message });
        return { success: false, reason: err.message };
    }
}

module.exports = { triggerSmsFallback };
