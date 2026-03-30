const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { logAction } = require('../services/auditService');
const { decrypt } = require('../services/encryptionService');
const { reminderWorker, connection } = require('../services/queueService');
const prisma = require('../services/prisma');

router.get('/config-status', asyncHandler(async (req, res) => {
    const clinic = req.clinic;
    const apiKeys = JSON.parse(clinic.apiKeys || '{}');
    const warnings = [];

    if (!apiKeys.gemini) warnings.push({ key: 'AI', message: 'Το Gemini API key δεν έχει ρυθμιστεί. Η ανάλυση AI δεν θα λειτουργεί.' });
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

/**
 * GET /api/system/stats
 * Operational metrics for the System Status panel.
 * Reads directly from DB — no n8n dependency.
 */
router.get('/stats', asyncHandler(async (req, res) => {
    const clinicId = req.clinicId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
        missedCallsToday,
        smsSentToday,
        smsFailedToday,
        pendingNotifications,
        recoveredThisMonth,
        totalMissedCalls,
    ] = await Promise.all([
        prisma.missedCall.count({
            where: { clinicId, createdAt: { gte: todayStart } },
        }),
        prisma.missedCall.count({
            where: { clinicId, smsStatus: 'sent', updatedAt: { gte: todayStart } },
        }),
        prisma.missedCall.count({
            where: { clinicId, smsStatus: 'failed', updatedAt: { gte: todayStart } },
        }),
        prisma.notification.count({
            where: { clinicId, status: 'SCHEDULED' },
        }),
        prisma.missedCall.count({
            where: {
                clinicId,
                status: 'RECOVERED',
                recoveredAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
        }),
        prisma.missedCall.count({
            where: { clinicId, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        }),
    ]);

    const recoveryRate = totalMissedCalls > 0
        ? Math.round((recoveredThisMonth / totalMissedCalls) * 100)
        : 0;

    res.json({
        missedCallsToday,
        smsSentToday,
        smsFailedToday,
        pendingNotifications,
        recoveredThisMonth,
        recoveryRate,
    });
}));

module.exports = router;
