const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { sendDirectMessage } = require('../services/messagingService');

router.post('/send', asyncHandler(async (req, res) => {
    const { patientId, message, type = 'SMS' } = req.body;

    if (!patientId || !message) {
        return res.status(400).json({ error: 'patientId and message are required' });
    }

    const { data } = await sendDirectMessage(
        { clinicId: req.clinicId, patientId, message, type, clinic: req.clinic },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

module.exports = router;
