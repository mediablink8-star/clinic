const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const { getUsage, getLogs, addCredits, createClinic } = require('../services/adminService');
const { PLANS, getPlanLimits } = require('../services/planService');
const prisma = require('../services/prisma');
const { validate, addCreditsSchema } = require('../services/validationService');
const { requirePlatformAdmin } = require('../middleware/adminAuth');

// Apply platform admin protection to all routes in this router
router.use(requirePlatformAdmin);

router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getUsage();
    res.json(data);
}));

router.get('/logs', asyncHandler(async (req, res) => {
    const { data } = await getLogs();
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

router.post('/add-credits', validate(addCreditsSchema), asyncHandler(async (req, res) => {
    const { clinicId, amount } = req.body;
    const { data } = await addCredits({ clinicId, amount });
    res.json({ success: true, ...data });
}));

// List available plans
router.get('/plans', (req, res) => {
    res.json(PLANS);
});

// Assign a plan to a clinic — updates limits immediately
router.post('/clinics/:clinicId/plan', asyncHandler(async (req, res) => {
    const { clinicId } = req.params;
    const { plan } = req.body;

    if (!PLANS[plan]) {
        throw new AppError('VALIDATION_ERROR', `Invalid plan. Valid plans: ${Object.keys(PLANS).join(', ')}`, 400);
    }

    const limits = getPlanLimits(plan);
    const updated = await prisma.clinic.update({
        where: { id: clinicId },
        data: { ...limits },
        select: { id: true, name: true, smsMonthlyLimit: true, dailyMessageCap: true, aiMonthlyLimit: true }
    });

    res.json({ success: true, clinic: updated, plan, limits });
}));

module.exports = router;
