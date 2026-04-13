const express = require('express');
const twilio = require('twilio');
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../services/prisma');
const { processVoiceIntent } = require('../services/voiceProcessor');
const { recordInboundMessage, handleTwilioStatusCallback } = require('../services/recoveryTrackingService');
const { handleMissedCall } = require('../services/missedCallService');

const router = express.Router();

router.post('/voice', asyncHandler(async (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const { SpeechResult, clinicId } = req.body;
    const clinic = clinicId ? await prisma.clinic.findUnique({ where: { id: clinicId } }) : await prisma.clinic.findFirst();
    if (!clinic) {
        twiml.say({ language: 'el-GR' }, 'Παρουσιάστηκε σφάλμα.');
        return res.type('text/xml').send(twiml.toString());
    }
    if (!SpeechResult) {
        const gather = twiml.gather({ input: 'speech', language: 'el-GR', speechTimeout: 'auto', action: '/webhooks/twilio/voice' });
        gather.say({ language: 'el-GR' }, `Γεια σας! Καλέσατε το ιατρείο ${clinic.name}. Πώς μπορώ να σας εξυπηρετήσω;`);
    } else {
        const result = await processVoiceIntent(SpeechResult, clinic);
        twiml.say({ language: 'el-GR' }, result.suggestedResponse || 'Σας ευχαριστούμε.');
    }
    res.type('text/xml').send(twiml.toString());
}));

router.post('/sms', asyncHandler(async (req, res) => {
    const clinicId = req.body.clinicId || req.query.clinicId;
    const from = req.body.From || req.body.from;
    const body = req.body.Body || req.body.body;
    const callSid = req.body.CallSid || req.body.callSid;

    if (!clinicId || !from) return res.status(400).json({ error: 'clinicId and from are required' });
    if (callSid) await handleMissedCall({ phone: from, clinicId, callSid });

    await recordInboundMessage({
        clinicId,
        fromPhone: from,
        body: body || '',
        providerMessageSid: req.body.MessageSid || req.body.SmsSid || null,
        providerStatusRaw: req.body.MessageStatus || req.body.SmsStatus || 'received',
    }).catch((err) => console.error('[TWILIO_SMS] inbound save failed', err.message));

    res.json({ success: true });
}));

router.post('/status', asyncHandler(async (req, res) => {
    const result = await handleTwilioStatusCallback({
        providerMessageSid: req.body.MessageSid || req.body.SmsSid || null,
        providerStatusRaw: req.body.MessageStatus || req.body.SmsStatus || null,
        clinicId: req.body.clinicId || req.query.clinicId || null,
        missedCallId: req.body.missedCallId || req.query.missedCallId || null,
        recoveryCaseId: req.body.recoveryCaseId || req.query.recoveryCaseId || null,
        errorCode: req.body.ErrorCode || null,
        errorMessage: req.body.ErrorMessage || null,
        toPhone: req.body.To || req.body.to || null,
        fromPhone: req.body.From || req.body.from || null,
    });
    res.json(result);
}));

module.exports = router;
