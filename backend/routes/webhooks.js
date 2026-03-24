const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { handleMissedCall } = require('../services/missedCallService');

// POST /api/webhook/missed-call
// Auth: HMAC via webhookAuth middleware (applied in index.js)
router.post('/missed-call', asyncHandler(async (req, res) => {
    const { phone = '+30690000000', clinicId, callSid } = req.body;

    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });

    const { data } = await handleMissedCall({ phone, clinicId, callSid });

    if (data.duplicate) {
        return res.json({ success: true, duplicate: true, missedCallId: data.missedCallId });
    }

    res.json({ success: true, ...data });
}));

module.exports = router;
