const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getClinic, getClinicUsage, updateClinicAdmin, updateClinicInfo, updateAiConfig, updateClinicStatus } = require('../services/clinicService');
const { logAction } = require('../services/auditService');
const { validate, clinicUpdateSchema, clinicInfoSchema, aiConfigSchema } = require('../services/validationService');
const prisma = require('../services/prisma');
const { encrypt, decrypt } = require('../services/encryptionService');

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
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
            return res.status(400).json({ error: `Invalid URL for ${field}` });
        }
    }

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
            ...(webhookSecret !== undefined && { webhookSecret: webhookSecret || undefined }),
            ...(webhookMissedCall !== undefined && { webhookMissedCall: webhookMissedCall || null }),
            ...(webhookAppointment !== undefined && { webhookAppointment: webhookAppointment || null }),
            ...(webhookReminders !== undefined && { webhookReminders: webhookReminders || null }),
            ...(webhookDirectSms !== undefined && { webhookDirectSms: webhookDirectSms || null }),
            ...(webhookInboundSms !== undefined && { webhookInboundSms: webhookInboundSms || null }),
        },
        select: {
            webhookUrl: true, webhookSecret: true,
            webhookMissedCall: true, webhookAppointment: true,
            webhookReminders: true, webhookDirectSms: true, webhookInboundSms: true,
        }
    });

    res.json({ success: true, data });
}));


// PUT /api/clinic/vonage — store per-clinic Vonage credentials (encrypted)
router.put('/vonage', requireOwner, asyncHandler(async (req, res) => {
    const { vonageApiKey, vonageApiSecret, vonageFromName } = req.body;

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(vonageApiKey !== undefined && { vonageApiKey: vonageApiKey ? encrypt(vonageApiKey) : null }),
            ...(vonageApiSecret !== undefined && { vonageApiSecret: vonageApiSecret ? encrypt(vonageApiSecret) : null }),
            ...(vonageFromName !== undefined && { vonageFromName: vonageFromName || null }),
        },
        select: { vonageFromName: true }
    });

    res.json({ success: true, data: { vonageFromName: data.vonageFromName, vonageApiKey: vonageApiKey ? '***' : null } });
}));

// GET /api/clinic/vonage — return masked credentials
router.get('/vonage', requireOwner, asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { vonageApiKey: true, vonageApiSecret: true, vonageFromName: true }
    });

    res.json({
        vonageApiKey: clinic?.vonageApiKey ? '***configured***' : null,
        vonageApiSecret: clinic?.vonageApiSecret ? '***configured***' : null,
        vonageFromName: clinic?.vonageFromName || null,
    });
}));


// PUT /api/clinic/bland — store Bland AI credentials and voice settings
router.put('/bland', requireOwner, asyncHandler(async (req, res) => {
    const { blandApiKey, blandPhoneNumberId, blandVoiceId, voiceEnabled } = req.body;

    const data = await prisma.clinic.update({
        where: { id: req.clinicId },
        data: {
            ...(blandApiKey !== undefined && { blandApiKey: blandApiKey ? encrypt(blandApiKey) : null }),
            ...(blandPhoneNumberId !== undefined && { blandPhoneNumberId: blandPhoneNumberId || null }),
            ...(blandVoiceId !== undefined && { blandVoiceId: blandVoiceId || null }),
            ...(voiceEnabled !== undefined && { voiceEnabled: Boolean(voiceEnabled) }),
        },
        select: { blandPhoneNumberId: true, blandVoiceId: true, voiceEnabled: true }
    });

    res.json({ success: true, data });
}));

module.exports = router;



