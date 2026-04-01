const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getClinic, getClinicUsage, updateClinicAdmin, updateClinicInfo, updateAiConfig, updateClinicStatus } = require('../services/clinicService');
const { logAction } = require('../services/auditService');
const { validate, clinicUpdateSchema, clinicInfoSchema, aiConfigSchema } = require('../services/validationService');

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

module.exports = router;
