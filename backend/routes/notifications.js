const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../services/prisma');

router.get('/', asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
        where: { clinicId: req.clinicId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { appointment: { include: { patient: true } } }
    });
    res.json(notifications);
}));

module.exports = router;
