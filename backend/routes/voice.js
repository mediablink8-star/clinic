const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { processVoiceIntent } = require('../services/voiceProcessor');

router.post('/twilio', asyncHandler(async (req, res) => {
    const twilio = require('twilio');
    const twiml = new twilio.twiml.VoiceResponse();

    const { CallSid, From, To, SpeechResult, clinicId } = req.body;
    const targetClinicId = clinicId || req.query.clinicId;

    // For demo purposes, if no clinicId in query, fallback to the first clinic
    let clinic = targetClinicId 
        ? await prisma.clinic.findUnique({ where: { id: targetClinicId } })
        : await prisma.clinic.findFirst();

    if (!clinic) {
        twiml.say({ language: 'el-GR' }, 'Παρουσιάστηκε σφάλμα. Το ιατρείο δεν βρέθηκε.');
        return res.type('text/xml').send(twiml.toString());
    }

    if (!SpeechResult) {
        // Initial Greeting
        const gather = twiml.gather({
            input: 'speech',
            language: 'el-GR',
            speechTimeout: 'auto',
            action: `/api/voice/twilio?clinicId=${clinic.id}`
        });
        gather.say({ language: 'el-GR' }, `Γεια σας! Καλέσατε το ιατρείο ${clinic.name}. Πώς μπορώ να σας εξυπηρετήσω;`);
    } else {
        // Process speech
        try {
            const result = await processVoiceIntent(SpeechResult, clinic);
            
            twiml.say({ language: 'el-GR' }, result.suggestedResponse);
            
            // If they need to reply further
            if (result.intent !== 'CANCEL' && result.intent !== 'BOOK') {
                 const gather = twiml.gather({
                    input: 'speech',
                    language: 'el-GR',
                    speechTimeout: 'auto',
                    action: `/api/voice/twilio?clinicId=${clinic.id}`
                });
                // Small prompt to continue the conversation
                gather.say({ language: 'el-GR' }, 'Θέλετε κάτι άλλο;');
            } else {
                twiml.say({ language: 'el-GR' }, 'Σας ευχαριστούμε. Καλή σας μέρα!');
            }
        } catch {
            twiml.say({ language: 'el-GR' }, 'Συγγνώμη, δεν σας κατάλαβα. Παρακαλώ επαναλάβετε.');
            twiml.redirect(`/api/voice/twilio?clinicId=${clinic.id}`);
        }
    }

    res.type('text/xml').send(twiml.toString());
}));

module.exports = router;

// --- VONAGE VOICE ENDPOINTS ---

// In-memory store for call state (uuid → { clinicId, from, answered })
// Good enough for production — calls complete in seconds
const activeCalls = new Map();

// Answer URL — Vonage calls this when a call arrives
// Returns NCCO that just connects/rings (or plays message)
router.post('/vonage/answer', asyncHandler(async (req, res) => {
    const { uuid, from, to } = req.body;

    // Resolve clinic from the Vonage number (to)
    const clinic = await prisma.clinic.findFirst({ where: { phone: to } });
    const clinicId = clinic?.id || null;

    // Track this call
    activeCalls.set(uuid, { clinicId, from, to, answered: false, startedAt: Date.now() });

    // NCCO — just ring for up to 30s, then hang up (missed call)
    res.json([
        {
            action: 'talk',
            text: clinic
                ? `Καλέσατε το ιατρείο ${clinic.name}. Παρακαλώ περιμένετε.`
                : 'Παρακαλώ περιμένετε.',
            language: 'el-GR',
            bargeIn: false
        }
    ]);
}));

// Event URL — Vonage sends ALL call lifecycle events here
router.post('/vonage/event', asyncHandler(async (req, res) => {
    const { uuid, status, duration, from, to } = req.body;

    res.status(200).json({ received: true }); // Always respond fast

    if (!uuid) return;

    // Mark as answered
    if (status === 'answered') {
        const call = activeCalls.get(uuid);
        if (call) call.answered = true;
        return;
    }

    // Call completed — check if it was missed
    if (status === 'completed') {
        const call = activeCalls.get(uuid);
        activeCalls.delete(uuid);

        const wasAnswered = call?.answered || (parseInt(duration) > 0);
        if (wasAnswered) return; // Not a missed call

        // Resolve clinicId — from call state or from Vonage number
        let clinicId = call?.clinicId || null;
        const callerPhone = call?.from || from;
        const vonageNumber = call?.to || to;

        if (!clinicId && vonageNumber) {
            const clinic = await prisma.clinic.findFirst({ where: { phone: vonageNumber } });
            clinicId = clinic?.id || null;
        }

        if (!clinicId || !callerPhone) {
            console.warn(`[VONAGE] Missed call but could not resolve clinicId — from=${callerPhone} to=${vonageNumber}`);
            return;
        }

        // Import here to avoid circular deps
        const { handleMissedCall } = require('../services/missedCallService');
        try {
            await handleMissedCall({ phone: callerPhone, clinicId, callSid: uuid });
            console.log(`[VONAGE] Missed call processed — clinicId=${clinicId} from=${callerPhone}`);
        } catch (err) {
            console.error(`[VONAGE] handleMissedCall failed: ${err.message}`);
        }
    }
}));
