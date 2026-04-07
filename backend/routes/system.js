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

/**
 * GET /api/system/recovery-shadow
 * Compares legacy MissedCall metrics with the new recovery-tracking tables.
 * Safe for rollout validation before switching dashboard reads.
 */
router.get('/recovery-shadow', asyncHandler(async (req, res) => {
    const clinicId = req.clinicId;

    const [
        legacyTotalMissedCalls,
        legacyActiveMissedCalls,
        legacyRecoveredMissedCalls,
        legacyFailedSms,
        linkedRecoveryCases,
        newTotalRecoveryCases,
        newActiveRecoveryCases,
        newRecoveredCases,
        outboundMessages,
        deliveredMessages,
        failedMessages,
        activityEvents,
    ] = await Promise.all([
        prisma.missedCall.count({ where: { clinicId } }),
        prisma.missedCall.count({ where: { clinicId, status: { in: ['DETECTED', 'RECOVERING'] } } }),
        prisma.missedCall.count({ where: { clinicId, status: 'RECOVERED' } }),
        prisma.missedCall.count({ where: { clinicId, smsStatus: 'failed' } }),
        prisma.recoveryCase.count({ where: { clinicId, missedCallId: { not: null } } }),
        prisma.recoveryCase.count({ where: { clinicId } }),
        prisma.recoveryCase.count({ where: { clinicId, state: { in: ['ACTIVE', 'ENGAGED'] } } }),
        prisma.recoveryCase.count({ where: { clinicId, state: 'RECOVERED' } }),
        prisma.message.count({ where: { clinicId, direction: 'OUTBOUND' } }),
        prisma.message.count({ where: { clinicId, direction: 'OUTBOUND', status: 'DELIVERED' } }),
        prisma.message.count({ where: { clinicId, direction: 'OUTBOUND', status: 'FAILED' } }),
        prisma.activityEvent.count({ where: { clinicId } }),
    ]);

    const warnings = [];

    if (linkedRecoveryCases !== legacyTotalMissedCalls) {
        warnings.push({
            key: 'missing_recovery_cases',
            message: `Legacy missed calls (${legacyTotalMissedCalls}) do not match linked recovery cases (${linkedRecoveryCases}).`,
        });
    }

    if (newRecoveredCases !== legacyRecoveredMissedCalls) {
        warnings.push({
            key: 'recovered_mismatch',
            message: `Legacy recovered count (${legacyRecoveredMissedCalls}) does not match new recovered cases (${newRecoveredCases}).`,
        });
    }

    if (failedMessages < legacyFailedSms) {
        warnings.push({
            key: 'failed_sms_gap',
            message: `Legacy failed SMS count (${legacyFailedSms}) is greater than tracked failed outbound messages (${failedMessages}).`,
        });
    }

    res.json({
        legacy: {
            totalMissedCalls: legacyTotalMissedCalls,
            activeMissedCalls: legacyActiveMissedCalls,
            recoveredMissedCalls: legacyRecoveredMissedCalls,
            failedSms: legacyFailedSms,
        },
        tracking: {
            linkedRecoveryCases,
            totalRecoveryCases: newTotalRecoveryCases,
            activeRecoveryCases: newActiveRecoveryCases,
            recoveredCases: newRecoveredCases,
            outboundMessages,
            deliveredMessages,
            failedMessages,
            activityEvents,
        },
        parity: {
            missedCallsCovered: linkedRecoveryCases === legacyTotalMissedCalls,
            recoveredCountsMatch: newRecoveredCases === legacyRecoveredMissedCalls,
            warnings,
        }
    });
}));

module.exports = router;
