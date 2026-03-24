const express = require('express');
const router = express.Router();
const { classifyAppointment } = require('../services/aiTriage');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/analyze', asyncHandler(async (req, res) => {
    if (!req.body) return res.status(400).json({ error: 'Request body is missing' });
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const analysis = await classifyAppointment(reason, req.clinic);
    res.json(analysis);
}));

module.exports = router;
