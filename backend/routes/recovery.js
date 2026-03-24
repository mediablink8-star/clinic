const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
    const logs = await prisma.missedCall.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { patient: true }
    });
    res.json(logs);
}));

router.post('/:id/retry', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { data } = await retrySms({ clinicId: req.clinicId, missedCallId: id });
    res.json({ success: true, data });
}));

module.exports = router;
