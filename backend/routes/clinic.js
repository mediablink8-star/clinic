const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { 
    getClinic, 
    getClinicUsage, 
    updateClinicAdmin, 
    updateClinicInfo, 
    updateAiConfig, 
    updateClinicStatus,
    resetClinicToDefaults
} = require('../services/clinicService');
const { logAction } = require('../services/auditService');
const { validate, clinicUpdateSchema, clinicInfoSchema, aiConfigSchema } = require('../services/validationService');
const { PLANS, getPlanLimits, getPlanKeyByClinic, validateUpgrade, getUpgradeablePlans } = require('../services/planService');
const prisma = require('../services/prisma');
const { encrypt, decrypt } = require('../services/encryptionService');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Owner role required.', 403);
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user || !['ADMIN', 'OWNER'].includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Forbidden: Insufficient permissions', 403);
    }
    next();
};

// GET /api/clinic
router.get('/', asyncHandler(async (req, res) => {
    const { data } = await getClinic(req.clinicId);
    // Strip sensitive configuration flags for non-OWNER roles
    const isOwner = req.user.role === 'OWNER';
    const safe = isOwner ? data : {
        ...data,
        hasWebhookSecret: null,
        hasZadarmaCredentials: null,
        hasGeminiApiKey: null,
    };
    res.json({ ...safe, role: req.user.role, userId: req.user.userId });
}));

// GET /api/clinic/usage
router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getClinicUsage(req.clinicId);
    res.json(data);
    logAction({ clinicId: req.clinicId, userId: req.user.userId, action: 'READ_CLINIC_USAGE', entity: 'CLINIC', entityId: req.clinicId, ipAddress: req.ip }).catch(err =>
        logger.error('Audit Failed to log READ_CLINIC_USAGE', { error: err.message })
    );
}));

// GET /api/clinic/spending
router.get('/spending', asyncHandler(async (req, res) => {
    const prisma = require('../services/prisma');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalResult, monthResult, countResult] = await Promise.all([
        prisma.messageLog.aggregate({
            where: { clinicId: req.clinicId, status: { in: ['SENT', 'SIMULATED'] } },
            _sum: { cost: true }
        }),
        prisma.messageLog.aggregate({
            where: { clinicId: req.clinicId, status: { in: ['SENT', 'SIMULATED'] }, timestamp: { gte: monthStart } },
            _sum: { cost: true }
        }),
        prisma.messageLog.count({
            where: { clinicId: req.clinicId, status: { in: ['SENT', 'SIMULATED'] } }
        })
    ]);

    res.json({
        totalCreditsUsed: totalResult._sum.cost || 0,
        monthCreditsUsed: monthResult._sum.cost || 0,
        totalMessagesSent: countResult
    });
}));

// POST /api/clinic  (admin only)
router.post('/', requireAdmin, validate(clinicUpdateSchema), asyncHandler(async (req, res) => {
    const { data } = await updateClinicAdmin(
        { clinicId: req.clinicId, body: req.body, currentClinic: req.clinic },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

// PUT /api/clinic/settings
router.put('/settings', requireOwner, validate(clinicInfoSchema), asyncHandler(async (req, res) => {
    const { name, phone, email, location, timezone } = req.body;
    const { data } = await updateClinicInfo(
        { clinicId: req.clinicId, name, phone, email, location, timezone },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true, clinic: data });
}));

// PUT /api/clinic/ai-config
router.put('/ai-config', requireOwner, validate(aiConfigSchema), asyncHandler(async (req, res) => {
    const { data } = await updateAiConfig(
        { clinicId: req.clinicId, aiConfig: req.body },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true, aiConfig: data });
}));

// POST /api/clinic/toggle-status
router.post('/toggle-status', requireOwner, asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    const { data } = await updateClinicStatus(
        { clinicId: req.clinicId, isActive },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true, isActive: data.isActive });
}));



function isValidUrl(str) {
    if (!str) return true; // null/empty is allowed (clears the field)
    try { new URL(str); return true; } catch { return false; }
}

// PUT /api/clinic/webhooks
router.put('/webhooks', requireOwner, asyncHandler(async (req, res) => {
    const {
        webhookUrl,
        webhookSecret,
        webhookMissedCall,
        webhookAppointment,
        webhookReminders,
        webhookDirectSms,
        webhookInboundSms,
        webhookReviewRequest,
    } = req.body;

    // Validate all URLs
    const urlFields = { webhookUrl, webhookMissedCall, webhookAppointment, webhookReminders, webhookDirectSms, webhookInboundSms, webhookReviewRequest };
    for (const [field, val] of Object.entries(urlFields)) {
        if (val && !isValidUrl(val)) {
            throw new AppError('VALIDATION_ERROR', `Invalid URL for ${field}`, 400);
        }
    }

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
            ...(webhookSecret !== undefined && { webhookSecret: webhookSecret ? encrypt(webhookSecret) : null }),
            ...(webhookMissedCall !== undefined && { webhookMissedCall: webhookMissedCall || null }),
            ...(webhookAppointment !== undefined && { webhookAppointment: webhookAppointment || null }),
            ...(webhookReminders !== undefined && { webhookReminders: webhookReminders || null }),
            ...(webhookDirectSms !== undefined && { webhookDirectSms: webhookDirectSms || null }),
            ...(webhookInboundSms !== undefined && { webhookInboundSms: webhookInboundSms || null }),
            ...(webhookReviewRequest !== undefined && { webhookReviewRequest: webhookReviewRequest || null }),
        },
        select: {
            webhookUrl: true,
            webhookMissedCall: true, webhookAppointment: true,
            webhookReminders: true, webhookDirectSms: true, webhookInboundSms: true,
            webhookReviewRequest: true,
        }
    });

    res.json({ success: true, data });
}));

// PUT /api/clinic/vapi
router.put('/vapi', requireOwner, asyncHandler(async (req, res) => {
    const { vapiAssistantId, vapiPhoneNumberId, vapiCredentialId, zadarmaApiKey, zadarmaApiSecret, zadarmaPhoneNumber, voiceEnabled } = req.body;

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(vapiAssistantId !== undefined && { vapiAssistantId: vapiAssistantId || null }),
            ...(vapiPhoneNumberId !== undefined && { vapiPhoneNumberId: vapiPhoneNumberId || null }),
            ...(vapiCredentialId !== undefined && { vapiCredentialId: vapiCredentialId || null }),
            ...(zadarmaApiKey !== undefined && { zadarmaApiKey: zadarmaApiKey ? encrypt(zadarmaApiKey) : null }),
            ...(zadarmaApiSecret !== undefined && { zadarmaApiSecret: zadarmaApiSecret ? encrypt(zadarmaApiSecret) : null }),
            ...(zadarmaPhoneNumber !== undefined && { zadarmaPhoneNumber: zadarmaPhoneNumber || null }),
            ...(voiceEnabled !== undefined && { voiceEnabled: Boolean(voiceEnabled) }),
        },
        select: { vapiAssistantId: true, vapiPhoneNumberId: true, zadarmaPhoneNumber: true, voiceEnabled: true }
    });

    res.json({ success: true, data });
}));


// GET /api/clinic/vapi-config — get Vapi + Zadarma configuration status
router.get('/vapi-config', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { voiceEnabled: true, vapiAssistantId: true, vapiPhoneNumberId: true, zadarmaApiKey: true, zadarmaPhoneNumber: true }
    });

    const voiceConfigured = !!(clinic?.voiceEnabled && 
        clinic?.vapiAssistantId && 
        clinic?.vapiPhoneNumberId && 
        (clinic?.zadarmaApiKey || process.env.ZADARMA_API_KEY));

    res.json({
        voiceEnabled: clinic?.voiceEnabled || false,
        voiceConfigured,
        hasAssistant: !!clinic?.vapiAssistantId,
        hasPhoneNumber: !!clinic?.vapiPhoneNumberId,
        hasZadarmaCredentials: !!(clinic?.zadarmaApiKey || process.env.ZADARMA_API_KEY),
    });
}));

// PUT /api/clinic/gemini — store Gemini API key
router.put('/gemini', requireOwner, asyncHandler(async (req, res) => {
    const { geminiApiKey } = req.body;

    if (!geminiApiKey || !geminiApiKey.trim()) {
        throw new AppError('VALIDATION_ERROR', 'Gemini API Key is required', 400);
    }

    await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            geminiApiKey: encrypt(geminiApiKey)
        }
    });

    res.json({ success: true, message: 'Gemini API Key saved successfully' });
}));

// GET /api/clinic/gemini-config — check if Gemini is configured
router.get('/gemini-config', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { geminiApiKey: true }
    });

    const configured = !!(clinic?.geminiApiKey || process.env.GEMINI_API_KEY);

    res.json({ configured });
}));

const { sendDirectMessage, sendManagedSms } = require('../services/messagingService');

// POST /api/clinic/test-sms
router.post('/test-sms', requireOwner, asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone) throw new AppError('VALIDATION_ERROR', 'Phone number is required', 400);

    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    
    const result = await sendManagedSms({
        clinicId: req.clinicId,
        clinic,
        eventType: 'message.test',
        payload: {
            phone: require('../utils/phone').digitsOnly(phone),
            message: `Τεστ από το ClinicFlow για το ιατρείο: ${clinic.name}`,
            clinicName: clinic.name,
        },
        logType: 'TEST_SMS',
        treatMissingWebhookAsSimulated: false // Force failure if no webhook configured for test
    });

    res.json({ success: true, deliveryStatus: result.deliveryStatus });
}));

// POST /api/clinic/webhooks/test
router.post('/webhooks/test', requireOwner, asyncHandler(async (req, res) => {
    const { url } = req.body;
    if (!url) throw new AppError('VALIDATION_ERROR', 'URL is required', 400);

    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { webhookSecret: true, name: true }
    });

    const result = await triggerWebhook(
        'test.ping',
        { message: 'Test webhook ping from ClinicFlow', timestamp: new Date().toISOString() },
        url,
        clinic?.webhookSecret,
        { awaitResponse: true, clinic: { ...clinic, id: req.clinicId } }
    );

    res.json(result);
}));

// POST /api/clinic/webhooks/test-all
// Tests all 6 webhook event types in parallel. Used by the onboarding
// checklist to verify the n8n workflow chain end-to-end in one click.
router.post('/webhooks/test-all', requireOwner, asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const { triggerWebhook, resolveWebhookUrl } = require('../services/webhookService');

    const samples = [
        { eventType: 'missed_call.test',      label: 'Missed call',        payload: { caller: '+306900000001', callId: 'test-call-001', timestamp: new Date().toISOString() } },
        { eventType: 'appointment.test',      label: 'Appointment',        payload: { appointmentId: 'test-appt-001', patientPhone: '+306900000002', serviceName: 'Test Service', doctorName: 'Dr. Test', date: '2026-06-15', time: '10:00' } },
        { eventType: 'notification.test',     label: 'Reminder',           payload: { appointmentId: 'test-appt-001', patientPhone: '+306900000003', hoursUntil: 24 } },
        { eventType: 'message.direct_send.test', label: 'Direct SMS',       payload: { to: '+306900000004', body: 'Test direct SMS' } },
        { eventType: 'message.inbound.test',   label: 'Inbound message',    payload: { from: '+306900000005', body: 'Test inbound message', provider: 'sms' } },
        { eventType: 'review_request.test',    label: 'Review request',     payload: { patientPhone: '+306900000006', appointmentId: 'test-appt-001', clinicName: clinic.name } },
    ];

    const results = await Promise.all(samples.map(async (s) => {
        const url = resolveWebhookUrl(s.eventType, clinic);
        if (!url) {
            return { eventType: s.eventType, label: s.label, success: false, skipped: true, error: 'No URL configured' };
        }
        const result = await triggerWebhook(s.eventType, s.payload, null, null, { clinic });
        return { eventType: s.eventType, label: s.label, url, ...result };
    }));

    const summary = {
        total: results.length,
        passed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success && !r.skipped).length,
        skipped: results.filter(r => r.skipped).length,
    };

    res.json({ summary, results });
}));

// POST /api/clinic/gemini/test
router.post('/gemini/test', requireOwner, asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { geminiApiKey: true }
    });

    const apiKey = clinic?.geminiApiKey ? decrypt(clinic.geminiApiKey) : process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AppError('CONFIGURATION_ERROR', 'Gemini API Key not found', 400);

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Use a current model name. Try flash first, fall back gracefully.
        let text;
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
            const result = await model.generateContent('Say "Ready"');
            text = result.response.text();
        } catch (modelErr) {
            // Fallback to 1.5 if 2.0 isn't available for this key
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Say "Ready"');
            text = result.response.text();
        }
        res.json({ success: true, response: text.trim() });
    } catch (err) {
        // Return a proper error status so the frontend's catch fires consistently
        logger.warn('Gemini test failed', { clinicId: req.clinicId, err: err.message });
        return res.status(502).json({ success: false, error: err.message, code: 'AI_PROVIDER_ERROR' });
    }
}));

// POST /api/clinic/onboarding-complete
// Flips the clinic from "pre-onboarding" to "live". At this moment the trial
// clock starts (trialEndsAt = now + TRIAL_DAYS). Until this is called, the
// clinic can use the product but no trial countdown is running.
router.post('/onboarding-complete', requireOwner, asyncHandler(async (req, res) => {
    const existing = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { trialEndsAt: true, onboardingCompleted: true, plan: true, planStatus: true }
    });
    if (!existing) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    // Idempotent: if already completed, do not reset the trial clock.
    if (existing.onboardingCompleted && existing.trialEndsAt) {
        return res.json({
            success: true,
            data: { onboardingCompleted: true, trialEndsAt: existing.trialEndsAt, alreadyLive: true }
        });
    }

    const trialDays = Number(process.env.TRIAL_DAYS) || 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            onboardingCompleted: true,
            trialEndsAt,
            plan: 'trial',
            planStatus: 'trialing',
        },
        select: { id: true, onboardingCompleted: true, trialEndsAt: true, plan: true, planStatus: true }
    });

    logger.info('Clinic went live — trial clock started', {
        clinicId: req.clinicId,
        trialEndsAt: trialEndsAt.toISOString(),
        userId: req.user.userId,
    });

    res.json({ success: true, data });
}));

// POST /api/clinic/reset-defaults
router.post('/reset-defaults', requireOwner, asyncHandler(async (req, res) => {
    const { data } = await resetClinicToDefaults(req.clinicId, { userId: req.user.userId, ip: req.ip });
    res.json({ success: true, clinic: data });
}));

// GET /api/clinic/plans — list available plans
router.get('/plans', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId }, select: { plan: true } });
    const currentKey = getPlanKeyByClinic(clinic);
    const upgradeable = getUpgradeablePlans(currentKey);
    res.json({ currentPlan: currentKey, plans: upgradeable });
}));

// POST /api/clinic/upgrade-plan — self-service plan upgrade
// NOTE: Payment processing (Stripe) is not yet integrated.
// Upgrades must be assigned by a platform admin via /api/admin/clinics/:id/plan.
// This endpoint blocks self-service to prevent free plan escalation.
router.post('/upgrade-plan', requireOwner, asyncHandler(async (req, res) => {
    throw new AppError(
        'PAYMENT_REQUIRED',
        'Plan upgrades require payment. Please contact support to upgrade your plan.',
        402
    );
}));

module.exports = router;
