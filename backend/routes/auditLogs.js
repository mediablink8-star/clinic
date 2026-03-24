const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
    }
    next();
};

router.get('/', requireOwner, asyncHandler(async (req, res) => {
    const logs = await prisma.auditLog.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    res.json(logs);
}));

module.exports = router;
