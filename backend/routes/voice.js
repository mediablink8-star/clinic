const express = require('express');
const router = express.Router();
const { processVoiceIntent } = require('../services/voiceProcessor');

/**
 * @route POST /api/voice/webhook
 * @desc Webhook for Voice AI providers (Vapi, Twilio, etc.)
 */
router.post('/webhook', async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ error: 'Request body is missing' });
    }
    const { transcript, callerId } = req.body;

    if (!transcript) {
        return res.status(400).json({ error: 'Transcript missing' });
    }

    try {
        const result = await processVoiceIntent(transcript);

        // Log the intent (In a real scenario, we'd trigger DB booking or handoff to human)
        console.log(`[VOICE] Intent from ${callerId || 'Unknown'}: ${result.intent}`);

        res.json({
            reply: result.suggestedResponse,
            action: result.intent,
            data: result
        });
    } catch (error) {
        res.status(500).json({ error: 'Processing failed' });
    }
});

module.exports = router;
