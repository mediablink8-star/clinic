const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { logAction } = require('../services/auditService');
const { decrypt } = require('../services/encryptionService');
const { reminderWorker, connection } = require('../services/queueService');

router.get('/config-status', asyncHandler(async (req, res) => {
    const clinic = req.clinic;
    const apiKeys = JSON.parse(clinic.apiKeys || '{}');
    const warnings = [];

    if (!apiKeys.gemini) warnings.push({ key: 'AI', message: 'Το Gemini API key δεν έχει ρυθμιστεί. Η ανάλυση AI δεν θα λειτουργεί.' });
    if (!apiKeys.twilioSid || !apiKeys.twilioToken) warnings.push({ key: 'SMS', message: 'Τα Twilio credentials δεν έχουν ρυθμιστεί. Τα SMS δεν θα αποστέλλονται.' });
    if (!clinic.webhookUrl) warnings.push({ key: 'webhook', message: 'Δεν έχει ρυθμιστεί webhook URL. Η αυτοματοποίηση δεν θα λειτουργεί.' });
    if (!process.env.WEBHOOK_SECRET) warnings.push({ key: 'security', message: 'Δεν έχει οριστεί WEBHOOK_SECRET. Το webhook endpoint είναι ανοιχτό.' });

    res.json({
        AI: !!apiKeys.gemini,
        SMS: !!(apiKeys.twilioSid && apiKeys.twilioToken),
        recovery: !!clinic.webhookUrl,
        webhook: !!process.env.WEBHOOK_SECRET,
        warnings
    });
}));

router.get('/status', asyncHandler(async (req, res) => {
    const clinic = req.clinic;
    const apiKeys = JSON.parse(clinic.apiKeys || '{}');

    res.json({
        redis: connection ? connection.status === 'ready' : false,
        worker: reminderWorker ? reminderWorker.isRunning() : false,
        aiConfigured: !!apiKeys.gemini,
        twilioConfigured: !!(apiKeys.twilioSid && apiKeys.twilioToken),
        voiceConfigured: !!apiKeys.telephony,
        webhookConfigured: !!clinic.webhookUrl
    });

    logAction({ clinicId: req.clinicId, userId: req.user.userId, action: 'READ_SYSTEM_STATUS', entity: 'SYSTEM', ipAddress: req.ip }).catch(() => {});
}));

module.exports = router;
