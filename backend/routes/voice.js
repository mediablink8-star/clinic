const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');

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
            console.log(`[TWILIO VOICE] Intent: ${result.intent} from ${From}`);
            
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
                // Example of ending or transferring call
                // twiml.say({ language: 'el-GR' }, 'Σας ευχαριστούμε.');
            }
        } catch (err) {
            console.error(err);
            twiml.say({ language: 'el-GR' }, 'Συγγνώμη, δεν σας κατάλαβα. Παρακαλώ επαναλάβετε.');
            twiml.redirect(`/api/voice/twilio?clinicId=${clinic.id}`);
        }
    }

    res.type('text/xml').send(twiml.toString());
}));


module.exports = router;
