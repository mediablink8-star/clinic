const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { PrismaClient } = require('@prisma/client');
const { handleMissedCall } = require('../services/missedCallService');
const { forwardInboundMessage } = require('../services/webhookService');

const prisma = new PrismaClient();

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

/**
 * POST /api/webhook/sms
 * Receives inbound SMS messages from a provider (Twilio, etc.)
 * and forwards them to the clinic's configured n8n/Make webhook URL.
 *
 * Body (provider-agnostic normalized form):
 *   { clinicId, from, body, provider?, raw? }
 *
 * The `raw` field can carry the full provider payload for debugging.
 * Auth: HMAC via webhookAuth middleware (applied in index.js)
 */
router.post('/sms', asyncHandler(async (req, res) => {
    const { clinicId, from, body: messageBody, provider = 'sms', raw } = req.body;

    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
    if (!from) return res.status(400).json({ error: 'from is required' });
    if (!messageBody) return res.status(400).json({ error: 'body is required' });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    if (!clinic.webhookUrl) {
        console.log(`[SMS Inbound] clinicId=${clinicId} — no webhookUrl configured, skipping forward`);
        return res.json({ success: true, forwarded: false, reason: 'No webhook URL configured' });
    }

    const result = await forwardInboundMessage({ from, body: messageBody, provider, clinic, raw });

    res.json({ success: result.success, forwarded: result.success, ...(result.error ? { error: result.error } : {}) });
}));

module.exports = router;
