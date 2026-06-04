const express = require('express');
const router = express.Router();
const { classifyAppointment } = require('../services/aiTriage');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');

router.post('/analyze', asyncHandler(async (req, res) => {
    if (!req.body) throw new AppError('VALIDATION_ERROR', 'Request body is missing', 400);
    const { reason } = req.body;
    if (!reason) throw new AppError('VALIDATION_ERROR', 'Reason is required', 400);

    const analysis = await classifyAppointment(reason, req.clinic);
    res.json(analysis);
}));

module.exports = router;
