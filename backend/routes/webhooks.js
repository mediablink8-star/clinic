const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../services/prisma');
const { handleMissedCall } = require('../services/missedCallService');
const { forwardInboundMessage } = require('../services/webhookService');
const { recordInboundMessage } = require('../services/recoveryTrackingService');

router.post('/missed-call', asyncHandler(async (req, res) => {
    const { phone = '+30690000000', clinicId, callSid } = req.body;

    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });

    const { data } = await handleMissedCall({ phone, clinicId, callSid });

    if (data.duplicate) {
        return res.json({ success: true, duplicate: true, missedCallId: data.missedCallId });
    }

    res.json({ success: true, ...data });
}));

router.post('/sms', asyncHandler(async (req, res) => {
    const {
        clinicId,
        from,
        body: messageBody,
        provider = 'sms',
        raw,
        missedCallId = null,
        recoveryCaseId = null,
        providerMessageSid = null,
        providerStatusRaw = null,
    } = req.body;

    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });
    if (!from) return res.status(400).json({ error: 'from is required' });
    if (!messageBody) return res.status(400).json({ error: 'body is required' });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    await recordInboundMessage({
        clinicId,
        fromPhone: from,
        body: messageBody,
        providerMessageSid,
        providerStatusRaw: providerStatusRaw || provider,
        missedCallId,
        recoveryCaseId,
    }).catch((err) => {
        console.warn(`[SMS Inbound] Dual-write failed for clinicId=${clinicId}: ${err.message}`);
    });

    if (!clinic.webhookUrl) {
        console.log(`[SMS Inbound] clinicId=${clinicId} - no webhookUrl configured, skipping forward`);
        return res.json({ success: true, forwarded: false, reason: 'No webhook URL configured' });
    }

    const result = await forwardInboundMessage({ from, body: messageBody, provider, clinic, raw });

    res.json({ success: result.success, forwarded: result.success, ...(result.error ? { error: result.error } : {}) });
}));

module.exports = router;
