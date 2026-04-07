const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { retrySms } = require('../services/missedCallService');

router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await prisma.missedCall.aggregate({
        where: { clinicId: req.clinicId, status: 'RECOVERED' },
        _sum: { estimatedRevenue: true }
    });

    const recoveredCount = await prisma.missedCall.count({
        where: { clinicId: req.clinicId, status: 'RECOVERED' }
    });

    const pendingCount = await prisma.missedCall.count({
        where: { clinicId: req.clinicId, status: 'RECOVERING' }
    });

    res.json({
        recovered: recoveredCount,
        pending: pendingCount,
        revenue: stats._sum.estimatedRevenue || 0
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

    const [staleNoReply, patientEngaged, failedSms] = await Promise.all([
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
        summary: {
            staleCount: staleNoReply.length,
            engagedCount: patientEngaged.length,
            failedCount: failedSms.length,
            totalActionable: staleNoReply.length + patientEngaged.length + failedSms.length
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

    const { triggerWebhook } = require('../services/webhookService');
    let result;
    try {
        result = await triggerWebhook(
            'missed_call.followup',
            { phone: mc.fromNumber, missedCallId: mc.id, clinicId: mc.clinicId, isFollowUp: true },
            mc.clinic.webhookUrl,
            mc.clinic.webhookSecret,
            { maxRetries: 2, baseDelay: 500 }
        );
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
    const { phone = '+30690000000', callSid = `test_${Date.now()}` } = req.body;

    const { data } = await handleMissedCall({ 
        phone, 
        clinicId: req.clinicId, 
        callSid,
        source: 'DASHBOARD_TEST' 
    });

    res.json({ success: true, ...data });
}));

module.exports = router;
