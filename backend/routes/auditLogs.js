const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Απαιτείται ρόλος Ιδιοκτήτη.', 403);
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
