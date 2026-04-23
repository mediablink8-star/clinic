const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { retrySms } = require('../services/missedCallService');

router.get('/stats', asyncHandler(async (req, res) => {
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
    const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    const [recoveredStats, recoveringStats, recoveredCount, pendingCount,
           thisWeekMissed, lastWeekMissed, thisWeekRecovered, lastWeekRecovered] = await Promise.all([
        prisma.missedCall.aggregate({
            where: { clinicId: req.clinicId, status: 'RECOVERED' },
            _sum: { estimatedRevenue: true }
        }),
        prisma.missedCall.aggregate({
            where: { clinicId: req.clinicId, status: 'RECOVERING' },
            _sum: { estimatedRevenue: true }
        }),
        prisma.missedCall.count({ where: { clinicId: req.clinicId, status: 'RECOVERED' } }),
        prisma.missedCall.count({ where: { clinicId: req.clinicId, status: 'RECOVERING' } }),
        // This week
        prisma.missedCall.count({ where: { clinicId: req.clinicId, createdAt: { gte: weekStart } } }),
        // Last week
        prisma.missedCall.count({ where: { clinicId: req.clinicId, createdAt: { gte: lastWeekStart, lt: lastWeekEnd } } }),
        // This week recovered
        prisma.missedCall.count({ where: { clinicId: req.clinicId, status: 'RECOVERED', recoveredAt: { gte: weekStart } } }),
        // Last week recovered
        prisma.missedCall.count({ where: { clinicId: req.clinicId, status: 'RECOVERED', recoveredAt: { gte: lastWeekStart, lt: lastWeekEnd } } }),
    ]);

    const thisWeekRate = thisWeekMissed > 0 ? Math.round((thisWeekRecovered / thisWeekMissed) * 100) : 0;
    const lastWeekRate = lastWeekMissed > 0 ? Math.round((lastWeekRecovered / lastWeekMissed) * 100) : 0;
    const rateDelta = thisWeekRate - lastWeekRate;

    res.json({
        recovered: recoveredCount,
        pending: pendingCount,
        revenue: recoveredStats._sum.estimatedRevenue || 0,
        potentialRevenue: recoveringStats._sum.estimatedRevenue || 0,
        trend: {
            thisWeek: { missed: thisWeekMissed, recovered: thisWeekRecovered, rate: thisWeekRate },
            lastWeek: { missed: lastWeekMissed, recovered: lastWeekRecovered, rate: lastWeekRate },
            rateDelta,
        }
    });
}));

router.get('/log', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const logs = await prisma.missedCall.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { patient: true }
    });
    res.json(logs);
}));

/**
 * GET /api/recovery/insights
 * Returns actionable follow-up suggestions:
 * - Cases with no patient reply after 24h (stale RECOVERING)
 * - Cases where patient replied but no follow-up sent
 * - Cases with failed SMS
 */
router.get('/insights', asyncHandler(async (req, res) => {
    const clinicId = req.clinicId;
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const [staleNoReply, patientEngaged, failedSms, callbackRequested] = await Promise.all([
        // RECOVERING, SMS sent 24h+ ago, no reply (not ENGAGED in RecoveryCase)
        prisma.missedCall.findMany({
            where: {
                clinicId,
                status: 'RECOVERING',
                smsStatus: 'sent',
                lastSmsSentAt: { lte: cutoff24h },
                recoveryCase: { state: 'ACTIVE' } // ACTIVE = no reply yet
            },
            include: { patient: true, recoveryCase: true },
            orderBy: { lastSmsSentAt: 'asc' },
            take: 20
        }),
        // Patient replied (ENGAGED) but still not recovered
        prisma.missedCall.findMany({
            where: {
                clinicId,
                status: 'RECOVERING',
                recoveryCase: { state: 'ENGAGED' }
            },
            include: { patient: true, recoveryCase: true },
            orderBy: { updatedAt: 'desc' },
            take: 20
        }),
        // Failed SMS older than 1h (give time for transient failures)
        prisma.missedCall.findMany({
            where: {
                clinicId,
                smsStatus: 'failed',
                updatedAt: { lte: new Date(Date.now() - 60 * 60 * 1000) }
            },
            include: { patient: true },
            orderBy: { updatedAt: 'desc' },
            take: 10
        }),
        // Callback requests — conversationState = CALLBACK
        prisma.missedCall.findMany({
            where: {
                clinicId,
                conversationState: 'CALLBACK',
                status: { in: ['DETECTED', 'RECOVERING'] },
            },
            include: { patient: true },
            orderBy: { updatedAt: 'desc' },
            take: 20
        })
    ]);

    const formatEntry = (mc, type) => ({
        id: mc.id,
        type,
        phone: mc.fromNumber,
        patientName: mc.patient?.name || null,
        lastSmsSentAt: mc.lastSmsSentAt,
        createdAt: mc.createdAt,
        smsError: mc.smsError || null,
        hoursStale: mc.lastSmsSentAt
            ? Math.round((Date.now() - new Date(mc.lastSmsSentAt)) / 3600000)
            : null
    });

    res.json({
        staleNoReply: staleNoReply.map(mc => formatEntry(mc, 'STALE_NO_REPLY')),
        patientEngaged: patientEngaged.map(mc => formatEntry(mc, 'PATIENT_ENGAGED')),
        failedSms: failedSms.map(mc => formatEntry(mc, 'FAILED_SMS')),
        callbackRequested: callbackRequested.map(mc => formatEntry(mc, 'CALLBACK_REQUESTED')),
        summary: {
            staleCount: staleNoReply.length,
            engagedCount: patientEngaged.length,
            failedCount: failedSms.length,
            callbackCount: callbackRequested.length,
            totalActionable: staleNoReply.length + patientEngaged.length + failedSms.length + callbackRequested.length
        }
    });
}));

/**
 * POST /api/recovery/:id/followup
 * Send a follow-up SMS to a stale case via the existing webhook
 */
router.post('/:id/followup', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const mc = await prisma.missedCall.findFirst({
        where: { id, clinicId: req.clinicId },
        include: { clinic: true }
    });
    if (!mc) return res.status(404).json({ error: 'Not found' });
    if (!mc.clinic.webhookUrl) return res.status(400).json({ error: 'No webhook configured' });

    const { sendManagedSms } = require('../services/messagingService');
    let result;
    try {
        await sendManagedSms({
            clinicId: mc.clinicId,
            clinic: mc.clinic,
            eventType: 'missed_call.followup',
            payload: { phone: mc.fromNumber, missedCallId: mc.id, clinicId: mc.clinicId, isFollowUp: true },
            logType: 'SMS',
        });
        result = { success: true };
    } catch (err) {
        result = { success: false, error: err.message };
    }

    await prisma.missedCall.update({
        where: { id },
        data: result.success
            ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
            : { smsStatus: 'failed', smsError: result.error || 'Follow-up webhook failed' }
    });

    res.json({ success: result.success, error: result.success ? null : result.error });
}));

router.post('/:id/retry', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data } = await retrySms({ clinicId: req.clinicId, missedCallId: id });
    res.json({ success: true, data });
}));

/**
 * @route POST /api/recovery/test-trigger
 * @desc Manually triggers a missed call recovery flow for testing (from Dashboard)
 */
router.post('/test-trigger', asyncHandler(async (req, res) => {
    const { handleMissedCall } = require('../services/missedCallService');
    const { phone = '+30690000000', callSid = `test_${Date.now()}`, bypassCooldown = false } = req.body;

    const { data } = await handleMissedCall({ 
        phone, 
        clinicId: req.clinicId, 
        callSid,
        bypassCooldown,
        source: 'DASHBOARD_TEST' 
    });

    res.json({ success: true, ...data });
}));

module.exports = router;
