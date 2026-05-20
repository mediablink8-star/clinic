const express = require('express');
const router = express.Router();
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

// ── Logs (legacy) ──
router.get('/logs', asyncHandler(async (req, res) => {
    const { data } = await getLogs();
    res.json(data);
}));

module.exports = router;