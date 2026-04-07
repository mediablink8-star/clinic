const express = require('express');
const twilio = require('twilio');
const asyncHandler = require('../middleware/asyncHandler');
const { handleTwilioStatusCallback } = require('../services/recoveryTrackingService');

const router = express.Router();

function verifyTwilioSignature(req, res, next) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.headers['x-twilio-signature'];

    if (!authToken || !signature) {
        return next();
    }

    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const isValid = twilio.validateRequest(authToken, signature, url, req.body);

    if (!isValid) {
        return res.status(403).json({ error: 'Invalid Twilio signature' });
    }

    return next();
}

router.post('/twilio/status', verifyTwilioSignature, asyncHandler(async (req, res) => {
    const providerMessageSid = req.body.MessageSid || req.body.SmsSid || null;
    const providerStatusRaw = req.body.MessageStatus || req.body.SmsStatus || null;
    const errorCode = req.body.ErrorCode || null;
    const errorMessage = req.body.ErrorMessage || null;
    const clinicId = req.body.clinicId || req.query.clinicId || null;
    const missedCallId = req.body.missedCallId || req.query.missedCallId || null;
    const recoveryCaseId = req.body.recoveryCaseId || req.query.recoveryCaseId || null;
    const toPhone = req.body.To || req.body.to || null;
    const fromPhone = req.body.From || req.body.from || null;

    const result = await handleTwilioStatusCallback({
        providerMessageSid,
        providerStatusRaw,
        clinicId,
        missedCallId,
        recoveryCaseId,
        errorCode,
        errorMessage,
        toPhone,
        fromPhone,
    });

    res.json(result);
}));

module.exports = router;
