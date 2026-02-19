const express = require('express');
const router = express.Router();
const { classifyAppointment } = require('../services/aiTriage');

/**
 * @route POST /api/appointments/analyze
 * @desc Analyzes an appointment reason in real-time using Gemini
 */
router.post('/analyze', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    const { reason } = req.body;

    if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
    }

    try {
        // req.clinic is attached by requireClinic middleware in index.js
        const analysis = await classifyAppointment(reason, req.clinic);
        res.json(analysis);
    } catch (error) {
        console.error('Real-time analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze reason' });
    }
});

module.exports = router;
