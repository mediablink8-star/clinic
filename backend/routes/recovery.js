const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/stats', async (req, res) => {
    try {
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
    } catch (e) {
        console.error('Error fetching recovery stats:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/log', async (req, res) => {
    try {
        const logs = await prisma.missedCall.findMany({
            where: { clinicId: req.clinicId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { patient: true }
        });
        res.json(logs);
    } catch (e) {
        console.error('Error fetching recovery log:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
