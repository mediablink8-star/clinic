const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const {
    getUsage, getLogs, addCredits, createClinic,
    getUsers, updateUser, deleteUser,
    getAuditLogs, getPlatformStats, getOnboardingProgress,
    bulkUpdateClinics
} = require('../services/adminService');
const { PLANS, getPlanLimits } = require('../services/planService');
const prisma = require('../services/prisma');
const { validate, addCreditsSchema } = require('../services/validationService');
const { requirePlatformAdmin } = require('../middleware/adminAuth');
const { handleMissedCall } = require('../services/missedCallService');
const { normalizePhone } = require('../utils/phone');
const { logAction } = require('../services/auditService');
const logger = require('../utils/logger');

// Apply platform admin protection to all routes in this router
router.use(requirePlatformAdmin);

// ── Usage / Clinics ──
router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getUsage();
    res.json(data);
}));

router.post('/clinics', asyncHandler(async (req, res) => {
    const { name, ownerEmail, ownerPassword, ownerName } = req.body;

    if (!name || !ownerEmail || !ownerPassword) {
        throw new AppError('VALIDATION_ERROR', 'Clinic name, owner email and password are required', 400);
    }

    const { data } = await createClinic({ name, ownerEmail, ownerPassword, ownerName });
    res.status(201).json({ success: true, ...data });
}));

router.delete('/clinics/:clinicId', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    // Soft-delete: deactivate clinic instead of hard-deleting
    // This prevents accidental data loss and allows recovery
    await prisma.$transaction(async (tx) => {
        // Deactivate the clinic (disables all workflows)
        await tx.clinic.update({
            where: { id: clinicId },
            data: { isActive: false }
        });

        // Log the deletion for audit trail
        await tx.auditLog.create({
            data: {
                clinicId,
                userId: req.user?.userId || 'admin',
                action: 'DELETE_CLINIC',
                entity: 'CLINIC',
                entityId: clinicId,
                details: JSON.stringify({ clinicName: clinic.name, deletedAt: new Date().toISOString(), deletedBy: req.user?.userId || 'admin' })
            }
        });
    });

    res.json({ success: true, message: 'Το ιατρείο απενεργοποιήθηκε (soft-delete). Τα δεδομένα διατηρούνται.' });
}));

// ── Credits ──
router.post('/add-credits', validate(addCreditsSchema), asyncHandler(async (req, res) => {
    const { clinicId, amount } = req.body;
    const { data } = await addCredits({ clinicId, amount });
    res.json({ success: true, ...data });
}));

// ── Plans ──
router.get('/plans', (req, res) => {
    res.json(PLANS);
});

router.post('/clinics/:clinicId/plan', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const { plan } = req.body;

    if (!PLANS[plan]) {
        throw new AppError('VALIDATION_ERROR', `Invalid plan. Valid plans: ${Object.keys(PLANS).join(', ')}`, 400);
    }

    const limits = getPlanLimits(plan);
    const updated = await prisma.clinic.update({
        where: { id: clinicId },
        data: { ...limits, plan },
        select: { id: true, name: true, plan: true, smsMonthlyLimit: true, dailyMessageCap: true, aiMonthlyLimit: true }
    });

    res.json({ success: true, clinic: updated, plan, limits });
}));

// ── Toggle Clinic Status ──
router.post('/clinics/:clinicId/toggle-status', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const { isActive } = req.body;

    const updated = await prisma.clinic.update({
        where: { id: clinicId },
        data: { isActive },
        select: { id: true, name: true, isActive: true }
    });

    res.json({ success: true, clinic: updated });
}));

// ── Test missed call (operator diagnostics) ──
router.post('/clinics/:clinicId/test-missed-call', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const { phone } = req.body;

    if (!phone) {
        throw new AppError('VALIDATION_ERROR', 'phone is required', 400);
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
        throw new AppError('VALIDATION_ERROR', 'Invalid phone number', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, isActive: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const callSid = `test-${crypto.randomBytes(8).toString('hex')}`;
    const startedAt = Date.now();

    logger.info('[TEST_MISSED_CALL] Starting synthetic missed-call chain', {
        clinicId: clinic.id,
        clinicName: clinic.name,
        phoneTail: normalizedPhone.slice(-4),
        callSid
    });

    let result;
    try {
        result = await handleMissedCall({
            phone: normalizedPhone,
            clinicId: clinic.id,
            callSid,
            bypassCooldown: true,
            force: true,
            isSilent: false
        });
    } catch (err) {
        logger.error('[TEST_MISSED_CALL] handleMissedCall threw', { callSid, err: err.message });
        await logAction({
            clinicId: clinic.id,
            userId: req.user?.userId,
            action: 'TEST_MISSED_CALL',
            entity: 'CLINIC',
            entityId: clinic.id,
            details: { callSid, phoneTail: normalizedPhone.slice(-4), error: err.message },
            ipAddress: req.ip
        });
        throw err;
    }

    const data = result.data || {};
    const elapsedMs = Date.now() - startedAt;

    logger.info('[TEST_MISSED_CALL] Chain complete', {
        callSid,
        missedCallId: data.missedCallId,
        smsStatus: data.smsStatus,
        scheduledSmsAt: data.scheduledSmsAt,
        skipped: data.skipped || false,
        reason: data.reason || null,
        elapsedMs
    });

    await logAction({
        clinicId: clinic.id,
        userId: req.user?.userId,
        action: 'TEST_MISSED_CALL',
        entity: 'CLINIC',
        entityId: clinic.id,
        details: {
            callSid,
            phoneTail: normalizedPhone.slice(-4),
            missedCallId: data.missedCallId,
            smsStatus: data.smsStatus || (data.skipped ? 'skipped' : null),
            scheduledSmsAt: data.scheduledSmsAt || null,
            elapsedMs
        },
        ipAddress: req.ip
    });

    res.json({
        success: true,
        callSid,
        clinicId: clinic.id,
        clinicName: clinic.name,
        phoneTail: normalizedPhone.slice(-4),
        missedCallId: data.missedCallId,
        smsStatus: data.smsStatus || (data.skipped ? 'skipped' : null),
        scheduledSmsAt: data.scheduledSmsAt || null,
        reason: data.reason || null,
        skipped: !!data.skipped,
        elapsedMs
    });
}));

// ── Last test call per clinic (for the operator dashboard row) ──
router.get('/clinics/:clinicId/last-test-call', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const last = await prisma.missedCall.findFirst({
        where: { clinicId, callSid: { startsWith: 'test-' } },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            callSid: true,
            smsStatus: true,
            smsError: true,
            createdAt: true,
            lastSmsSentAt: true,
            fromNumber: true
        }
    });

    if (!last) {
        return res.json({ success: true, lastTestCall: null });
    }

    res.json({
        success: true,
        lastTestCall: {
            missedCallId: last.id,
            callSid: last.callSid,
            smsStatus: last.smsStatus,
            smsError: last.smsError,
            sentAt: last.lastSmsSentAt || last.createdAt,
            phoneTail: (last.fromNumber || '').slice(-4)
        }
    });
}));

// ── Per-clinic test-call summary (batched for the table) ──
router.get('/clinics/test-calls/last', asyncHandler(async (req, res) => {
    const clinics = await prisma.clinic.findMany({
        select: { id: true }
    });

    if (clinics.length === 0) {
        return res.json({ success: true, perClinic: {} });
    }

    const clinicIds = clinics.map(c => c.id);
    const mostRecent = await prisma.missedCall.findMany({
        where: { clinicId: { in: clinicIds }, callSid: { startsWith: 'test-' } },
        orderBy: { createdAt: 'desc' },
        distinct: ['clinicId'],
        select: {
            clinicId: true,
            id: true,
            callSid: true,
            smsStatus: true,
            smsError: true,
            createdAt: true,
            lastSmsSentAt: true
        }
    });

    const perClinic = {};
    for (const m of mostRecent) {
        perClinic[m.clinicId] = {
            missedCallId: m.id,
            callSid: m.callSid,
            smsStatus: m.smsStatus,
            smsError: m.smsError,
            sentAt: m.lastSmsSentAt || m.createdAt
        };
    }

    res.json({ success: true, perClinic });
}));

// ── Per-clinic setup checklist (operator onboarding view) ──
router.get('/clinics/:clinicId/setup-status', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            id: true,
            name: true,
            isActive: true,
            phone: true,
            zadarmaPhoneNumber: true,
            zadarmaApiKey: true,
            zadarmaApiSecret: true,
            vapiAssistantId: true,
            vapiPhoneNumberId: true,
            vapiCredentialId: true,
            voiceEnabled: true,
            webhookUrl: true,
            webhookMissedCall: true,
            workingHours: true,
            plan: true,
            trialEndsAt: true,
            planStatus: true,
        }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [recentTest, recentZadarmaTest, recentVapiActivity] = await Promise.all([
        prisma.missedCall.findFirst({
            where: { clinicId, callSid: { startsWith: 'test-' } },
            orderBy: { createdAt: 'desc' },
            select: { smsStatus: true, smsError: true, createdAt: true, lastSmsSentAt: true }
        }),
        prisma.missedCall.findFirst({
            where: { clinicId, callSid: { startsWith: 'zadarma-test-' } },
            orderBy: { createdAt: 'desc' },
            select: { smsStatus: true, smsError: true, createdAt: true, lastSmsSentAt: true }
        }),
        prisma.appointment.findFirst({
            where: { clinicId, source: 'AI_VOICE', createdAt: { gte: since } },
            orderBy: { createdAt: 'desc' },
            select: { id: true, createdAt: true }
        })
    ]);

    const testPassed = recentTest && (Date.now() - new Date(recentTest.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
    const testStatus = !recentTest ? 'untested'
        : testPassed && recentTest.smsStatus === 'sent' ? 'passed'
        : testPassed && recentTest.smsStatus === 'failed' ? 'failed'
        : testPassed && recentTest.smsStatus === 'scheduled' ? 'passed'
        : 'untested';

    const zadarmaPassed = recentZadarmaTest && (Date.now() - new Date(recentZadarmaTest.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
    const zadarmaStatus = !recentZadarmaTest ? 'untested'
        : zadarmaPassed && recentZadarmaTest.smsStatus === 'sent' ? 'passed'
        : zadarmaPassed && recentZadarmaTest.smsStatus === 'failed' ? 'failed'
        : zadarmaPassed && recentZadarmaTest.smsStatus === 'scheduled' ? 'passed'
        : 'untested';

    const vapiStatus = !clinic.vapiAssistantId ? 'untested'
        : recentVapiActivity ? 'passed'
        : clinic.voiceEnabled ? 'untested'
        : 'untested';

    const twilioCredsOk = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const twilioSenderOk = !!(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_ALPHA_SENDER_ID);

    let workingHoursOk = false;
    try {
        const wh = typeof clinic.workingHours === 'string' ? JSON.parse(clinic.workingHours) : (clinic.workingHours || {});
        workingHoursOk = Object.values(wh).some(v => typeof v === 'string' && v.includes('-') && !v.toLowerCase().includes('closed'));
    } catch { workingHoursOk = false; }

    const trialActive = clinic.plan !== 'trial'
        || (clinic.trialEndsAt && new Date(clinic.trialEndsAt).getTime() > Date.now());

    const webhookUrlsOk = !!(clinic.webhookUrl || clinic.webhookMissedCall);

    res.json({
        success: true,
        clinicId: clinic.id,
        clinicName: clinic.name,
        isActive: clinic.isActive,
        plan: clinic.plan,
        trialEndsAt: clinic.trialEndsAt,
        checklist: {
            zadarmaNumber: clinic.zadarmaPhoneNumber ? 'configured' : 'missing',
            zadarmaWebhookTest: zadarmaStatus,
            vapiSipTest: vapiStatus,
            twilioSender: twilioSenderOk ? 'verified' : (twilioCredsOk ? 'unverified' : 'missing'),
            twilioCreds: twilioCredsOk ? 'configured' : 'missing',
            workingHours: workingHoursOk ? 'configured' : 'missing',
            webhookUrls: webhookUrlsOk ? 'configured' : 'missing',
            testMissedCall: testStatus,
            trialActive
        },
        meta: {
            testLastAt: recentTest?.lastSmsSentAt || recentTest?.createdAt || null,
            testLastStatus: recentTest?.smsStatus || null,
            testLastError: recentTest?.smsError || null,
            zadarmaTestLastAt: recentZadarmaTest?.lastSmsSentAt || recentZadarmaTest?.createdAt || null,
            zadarmaTestLastStatus: recentZadarmaTest?.smsStatus || null,
            zadarmaTestLastError: recentZadarmaTest?.smsError || null,
            vapiLastActivityAt: recentVapiActivity?.createdAt || null,
        }
    });
}));

// ── Zadarma webhook self-test ──
// Simulates NOTIFY_START + NOTIFY_END (disposition=missed) that Zadarma would
// send to our webhook. Exercises the same code path that runs in production
// for a real missed call routed through the Zadarma SIP trunk.
router.post('/clinics/:clinicId/test-zadarma-webhook', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const phone = (req.body && req.body.phone) ? normalizePhone(req.body.phone) : '+306900000000';

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, isActive: true, zadarmaPhoneNumber: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    if (!clinic.zadarmaPhoneNumber) {
        throw new AppError(
            'VALIDATION_ERROR',
            'Το ιατρείο δεν έχει zadarmaPhoneNumber. Ρυθμίστε το πρώτα στις ρυθμίσεις τηλεφωνίας.',
            400
        );
    }

    const callSid = `zadarma-test-${crypto.randomBytes(8).toString('hex')}`;
    const startedAt = Date.now();

    logger.info('[ZADARMA_TEST] Starting synthetic Zadarma call chain', {
        clinicId: clinic.id,
        clinicName: clinic.name,
        zadarmaNumber: clinic.zadarmaPhoneNumber,
        callSid
    });

    const startResult = await handleMissedCall({
        phone,
        clinicId: clinic.id,
        callSid,
        isSilent: true
    });

    const endResult = await handleMissedCall({
        phone,
        clinicId: clinic.id,
        callSid,
        bypassCooldown: true,
        force: true,
        isSilent: false
    });

    const data = endResult.data || {};
    const elapsedMs = Date.now() - startedAt;

    logger.info('[ZADARMA_TEST] Chain complete', {
        callSid,
        startResult: startResult.data,
        missedCallId: data.missedCallId,
        smsStatus: data.smsStatus,
        scheduledSmsAt: data.scheduledSmsAt,
        skipped: data.skipped || false,
        reason: data.reason || null,
        elapsedMs
    });

    await logAction({
        clinicId: clinic.id,
        userId: req.user?.userId,
        action: 'TEST_ZADARMA_WEBHOOK',
        entity: 'CLINIC',
        entityId: clinic.id,
        details: {
            callSid,
            zadarmaNumber: clinic.zadarmaPhoneNumber,
            missedCallId: data.missedCallId,
            smsStatus: data.smsStatus || (data.skipped ? 'skipped' : null),
            scheduledSmsAt: data.scheduledSmsAt || null,
            reason: data.reason || null,
            elapsedMs
        },
        ipAddress: req.ip
    });

    res.json({
        success: true,
        callSid,
        clinicId: clinic.id,
        clinicName: clinic.name,
        zadarmaNumber: clinic.zadarmaPhoneNumber,
        phoneTail: phone.slice(-4),
        start: { missedCallId: startResult.data?.missedCallId, status: startResult.data?.status || 'silent' },
        end: {
            missedCallId: data.missedCallId,
            smsStatus: data.smsStatus || (data.skipped ? 'skipped' : null),
            scheduledSmsAt: data.scheduledSmsAt || null,
            reason: data.reason || null,
            skipped: !!data.skipped
        },
        elapsedMs
    });
}));

// ── User Management ──
router.get('/users', asyncHandler(async (req, res) => {
    const { data } = await getUsers();
    res.json(data);
}));

router.patch('/users/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;
    const { data } = await updateUser(userId, updates);
    res.json({ success: true, data });
}));

router.delete('/users/:userId', asyncHandler(async (req, res) => {
    const { userId } = req.params;
    await deleteUser(userId);
    res.json({ success: true });
}));

// ── Audit Logs ──
router.get('/audit-logs', asyncHandler(async (req, res) => {
    const { action, entity, startDate, endDate, limit = 100 } = req.query;
    const { data, total } = await getAuditLogs({
        action, entity, startDate, endDate,
        limit: parseInt(limit)
    });
    res.json({ success: true, data, total });
}));

// ── Maintenance ──
router.post('/maintenance/backfill-recovery', asyncHandler(async (req, res) => {
    const { days = 30, limit = 100 } = req.body;
    const { backfillRecoveryCases } = require('../services/recoveryTrackingService');
    const result = await backfillRecoveryCases({ days, limit });
    res.json({ success: true, ...result });
}));

// ── Platform Stats ──
router.get('/stats', asyncHandler(async (req, res) => {
    const { data } = await getPlatformStats();
    res.json(data);
}));

// ── Onboarding Progress ──
router.get('/onboarding-progress', asyncHandler(async (req, res) => {
    const { data } = await getOnboardingProgress();
    res.json(data);
}));

// ── Bulk Actions ──
router.post('/bulk-action', asyncHandler(async (req, res) => {
    const { clinicIds, action, value } = req.body;
    const result = await bulkUpdateClinics(clinicIds, action, value);
    res.json(result);
}));

router.get('/webhook-health', requirePlatformAdmin, asyncHandler(async (req, res) => {
    // Per-clinic last-successful-delivery timestamp grouped by event type.
    // Used by the admin dashboard to show green/red dots.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
    const deliveries = await prisma.webhookDelivery.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 5000,
        select: {
            clinicId: true,
            eventType: true,
            success: true,
            httpStatus: true,
            errorMessage: true,
            createdAt: true,
        },
    });

    // Group by clinicId + eventType → last success, last failure, consecutive-failure streak
    const byClinic = new Map();
    for (const d of deliveries) {
        const key = `${d.clinicId}::${d.eventType}`;
        if (!byClinic.has(key)) {
            byClinic.set(key, {
                clinicId: d.clinicId,
                eventType: d.eventType,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastError: null,
                lastHttpStatus: null,
                failureCount24h: 0,
                totalCount24h: 0,
                consecutiveFailures: 0,
            });
        }
        const entry = byClinic.get(key);
        if (d.success && (!entry.lastSuccessAt || d.createdAt > entry.lastSuccessAt)) {
            entry.lastSuccessAt = d.createdAt;
        }
        if (!d.success && (!entry.lastFailureAt || d.createdAt > entry.lastFailureAt)) {
            entry.lastFailureAt = d.createdAt;
            entry.lastError = d.errorMessage;
            entry.lastHttpStatus = d.httpStatus;
        }
        if (d.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
            entry.totalCount24h++;
            if (!d.success) entry.failureCount24h++;
        }
    }

    // Compute consecutive-failure streak per (clinic, event) by walking
    // deliveries in reverse chronological order and counting from the most recent.
    const streakCounts = new Map();
    for (const d of deliveries) {
        if (d.success) continue;
        const key = `${d.clinicId}::${d.eventType}`;
        streakCounts.set(key, (streakCounts.get(key) || 0) + 1);
    }
    for (const [key, count] of streakCounts.entries()) {
        const entry = byClinic.get(key);
        if (entry) entry.consecutiveFailures = count;
    }

    // Per-clinic aggregate: which clinics have stale or failing webhooks
    const clinicIds = [...new Set(deliveries.map(d => d.clinicId))];
    const clinics = await prisma.clinic.findMany({
        where: { id: { in: clinicIds } },
        select: { id: true, name: true, onboardingCompleted: true, webhookUrl: true, webhookMissedCall: true },
    });
    const clinicMap = new Map(clinics.map(c => [c.id, c]));

    const perClinic = clinicIds.map(id => {
        const clinic = clinicMap.get(id);
        const entries = [...byClinic.values()].filter(e => e.clinicId === id);
        const lastSuccess = entries.reduce((acc, e) => (!acc || e.lastSuccessAt > acc ? e.lastSuccessAt : acc), null);
        const lastFailure = entries.reduce((acc, e) => (!acc || e.lastFailureAt > acc ? e.lastFailureAt : acc), null);
        const failingEventTypes = entries.filter(e => e.failureCount24h > 0).map(e => e.eventType);
        const consecutiveFailures = entries.reduce((m, e) => Math.max(m, e.consecutiveFailures || 0), 0);
        const totalCount24h = entries.reduce((s, e) => s + (e.totalCount24h || 0), 0);
        const failureCount24h = entries.reduce((s, e) => s + (e.failureCount24h || 0), 0);
        const staleThreshold = 60 * 60 * 1000; // 1 hour
        const stale = !lastSuccess || (Date.now() - new Date(lastSuccess).getTime() > staleThreshold);
        const status = !lastSuccess && !lastFailure
            ? 'unknown'
            : (consecutiveFailures >= 5 || stale) ? 'failing'
            : (consecutiveFailures > 0) ? 'degraded'
            : 'healthy';
        return {
            clinicId: id,
            clinicName: clinic?.name || 'Unknown',
            onboardingCompleted: clinic?.onboardingCompleted || false,
            webhookUrl: clinic?.webhookUrl || null,
            webhookMissedCall: clinic?.webhookMissedCall || null,
            lastSuccessAt: lastSuccess,
            lastFailureAt: lastFailure,
            stale,
            status,
            consecutiveFailures,
            failureCount24h,
            totalCount24h,
            failingEventTypes,
        };
    });

    perClinic.sort((a, b) => {
        const order = { failing: 0, degraded: 1, unknown: 2, healthy: 3 };
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
        return (b.lastFailureAt?.getTime() || 0) - (a.lastFailureAt?.getTime() || 0);
    });

    const summary = {
        totalClinics: perClinic.length,
        healthy: perClinic.filter(p => p.status === 'healthy').length,
        degraded: perClinic.filter(p => p.status === 'degraded').length,
        failing: perClinic.filter(p => p.status === 'failing').length,
        unknown: perClinic.filter(p => p.status === 'unknown').length,
        windowHours: 168,
        computedAt: new Date().toISOString(),
    };

    res.json({
        summary,
        perClinic,
        byEventType: [...byClinic.values()],
    });
}));

router.get('/logs', asyncHandler(async (req, res) => {
    const { data } = await getLogs();
    res.json(data);
}));

router.get('/holidays', asyncHandler(async (req, res) => {
    const months = Math.min(Math.max(parseInt(req.query.months) || 12, 1), 24);
    const country = req.query.country || 'GR';
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setUTCMonth(end.getUTCMonth() + months);

    const holidays = await prisma.holiday.findMany({
        where: {
            country,
            date: { gte: today, lt: end }
        },
        orderBy: { date: 'asc' }
    });
    res.json({ country, months, total: holidays.length, holidays });
}));

module.exports = router;