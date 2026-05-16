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
const { PLANS, getPlanLimits, getUpgradeablePlans } = require('../services/planService');
const prisma = require('../services/prisma');
const { encrypt, decrypt } = require('../services/encryptionService');
const AppError = require('../errors/AppError');

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
    res.json(data);
}));

// GET /api/clinic/usage
router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getClinicUsage(req.clinicId);
    res.json(data);
    logAction({ clinicId: req.clinicId, userId: req.user.userId, action: 'READ_CLINIC_USAGE', entity: 'CLINIC', entityId: req.clinicId, ipAddress: req.ip }).catch(() => {});
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
    } = req.body;

    // Validate all URLs
    const urlFields = { webhookUrl, webhookMissedCall, webhookAppointment, webhookReminders, webhookDirectSms, webhookInboundSms };
    for (const [field, val] of Object.entries(urlFields)) {
        if (val && !isValidUrl(val)) {
            throw new AppError('VALIDATION_ERROR', `Invalid URL for ${field}`, 400);
        }
    }

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
            ...(webhookSecret !== undefined && { webhookSecret: webhookSecret === '' ? null : webhookSecret }),
            ...(webhookMissedCall !== undefined && { webhookMissedCall: webhookMissedCall || null }),
            ...(webhookAppointment !== undefined && { webhookAppointment: webhookAppointment || null }),
            ...(webhookReminders !== undefined && { webhookReminders: webhookReminders || null }),
            ...(webhookDirectSms !== undefined && { webhookDirectSms: webhookDirectSms || null }),
            ...(webhookInboundSms !== undefined && { webhookInboundSms: webhookInboundSms || null }),
        },
        select: {
            webhookUrl: true,
            webhookMissedCall: true, webhookAppointment: true,
            webhookReminders: true, webhookDirectSms: true, webhookInboundSms: true,
        }
    });

    res.json({ success: true, data });
}));

// PUT /api/clinic/vapi
router.put('/vapi', requireOwner, asyncHandler(async (req, res) => {
    const { vapiApiKey, vapiAssistantId, vapiPhoneNumberId, vapiCredentialId, voiceEnabled } = req.body;

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(vapiApiKey !== undefined && { vapiApiKey: vapiApiKey ? encrypt(vapiApiKey) : null }),
            ...(vapiAssistantId !== undefined && { vapiAssistantId: vapiAssistantId || null }),
            ...(vapiPhoneNumberId !== undefined && { vapiPhoneNumberId: vapiPhoneNumberId || null }),
            ...(vapiCredentialId !== undefined && { vapiCredentialId: vapiCredentialId || null }),
            ...(voiceEnabled !== undefined && { voiceEnabled: Boolean(voiceEnabled) }),
        },
        select: { vapiAssistantId: true, vapiPhoneNumberId: true, voiceEnabled: true }
    });

    res.json({ success: true, data });
}));


// GET /api/clinic/vapi-config — get Vapi configuration status
router.get('/vapi-config', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { voiceEnabled: true, vapiAssistantId: true, vapiPhoneNumberId: true, vapiApiKey: true }
    });

    const vapiConfigured = !!(clinic?.voiceEnabled && 
        clinic?.vapiAssistantId && 
        clinic?.vapiPhoneNumberId && 
        (clinic?.vapiApiKey || process.env.VAPI_API_KEY));

    res.json({
        voiceEnabled: clinic?.voiceEnabled || false,
        vapiConfigured,
        hasAssistant: !!clinic?.vapiAssistantId,
        hasPhoneNumber: !!clinic?.vapiPhoneNumberId,
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
    if (!url || !isValidUrl(url)) throw new AppError('VALIDATION_ERROR', 'Invalid URL', 400);

    const axios = require('axios');
    const start = Date.now();
    try {
        await axios.post(url, { test: true, clinicId: req.clinicId }, { timeout: 5000 });
        res.json({ success: true, latency: Date.now() - start });
    } catch (err) {
        res.json({ success: false, error: err.message, latency: Date.now() - start });
    }
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
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say "Ready"');
        const text = result.response.text();
        res.json({ success: true, response: text.trim() });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
}));

// POST /api/clinic/onboarding-complete
router.post('/onboarding-complete', requireOwner, asyncHandler(async (req, res) => {
    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: { onboardingCompleted: true },
        select: { id: true, onboardingCompleted: true }
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
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId }, select: { smsMonthlyLimit: true } });
    const currentKey = Object.entries(PLANS).find(([, p]) => p.smsMonthlyLimit === clinic?.smsMonthlyLimit)?.[0] || 'trial';
    const upgradeable = getUpgradeablePlans(currentKey);
    res.json({ currentPlan: currentKey, plans: upgradeable });
}));

// POST /api/clinic/upgrade-plan — self-service plan upgrade
router.post('/upgrade-plan', requireOwner, asyncHandler(async (req, res) => {
    const { plan } = req.body;
    if (!plan || !PLANS[plan]) throw new AppError('VALIDATION_ERROR', 'Invalid plan', 400);

    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId }, select: { smsMonthlyLimit: true } });
    const currentKey = Object.entries(PLANS).find(([, p]) => p.smsMonthlyLimit === clinic?.smsMonthlyLimit)?.[0] || 'trial';
    const planOrder = ['trial', 'pro', 'business', 'scale'];
    const currentIdx = planOrder.indexOf(currentKey);
    const targetIdx = planOrder.indexOf(plan);

    if (targetIdx <= currentIdx) throw new AppError('VALIDATION_ERROR', 'Can only upgrade to a higher plan', 400);

    const limits = getPlanLimits(plan);
    const updated = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: { ...limits },
        select: { id: true, name: true, smsMonthlyLimit: true, dailyMessageCap: true, aiMonthlyLimit: true }
    });

    await logAction({
        clinicId: req.clinicId, userId: req.user.userId,
        action: 'UPGRADE_PLAN', entity: 'CLINIC', entityId: req.clinicId,
        details: { from: currentKey, to: plan }, ipAddress: req.ip
    });

    res.json({ success: true, plan, limits, clinic: updated });
}));

module.exports = router;



