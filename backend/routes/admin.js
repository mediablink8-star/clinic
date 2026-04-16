const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getUsage, getLogs, addCredits } = require('../services/adminService');
const { PLANS, getPlanLimits } = require('../services/planService');
const prisma = require('../services/prisma');

router.get('/usage', asyncHandler(async (req, res) => {
    const { data } = await getUsage();
    res.json(data);
}));

router.get('/logs', asyncHandler(async (req, res) => {
    const { data } = await getLogs();
    res.json(data);
}));

router.post('/add-credits', asyncHandler(async (req, res) => {
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
        return res.status(400).json({ error: `Invalid plan. Valid plans: ${Object.keys(PLANS).join(', ')}` });
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
