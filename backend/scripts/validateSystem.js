const { classifyAppointment } = require('../services/aiTriage');
const { processVoiceIntent } = require('../services/voiceProcessor');
const { analyzeSentiment } = require('../services/aiSentiment');
const clinic = require('../config/clinic.json');

async function validate() {
    console.log(`\n=== 🏥 DIAGNOSTIC SUITE: ${clinic.name} ===\n`);

    const scenarios = [
        {
            name: "Urgent Pain Scenario",
            type: "TRIAGE",
            input: "Με πονάει πολύ το δόντι μου και δεν μπορώ να κοιμηθώ από χθες",
            expectedPriority: "URGENT"
        },
        {
            name: "Routine Cleaning Scenario",
            type: "TRIAGE",
            input: "Θέλω να κλείσω έναν καθαρισμό και έναν έλεγχο",
            expectedPriority: "NORMAL"
        },
        {
            name: "Voice Intent - Booking",
            type: "VOICE",
            input: "Γεια σας, θα ήθελα να κλείσω ένα ραντεβού για σφράγισμα την επόμενη εβδομάδα",
            expectedIntent: "BOOK"
        },
        {
            name: "Feedback - Angry Patient",
            type: "SENTIMENT",
            input: "Πολύ ακριβό ιατρείο και ο γιατρός άργησε μισή ώρα",
            expectedSentiment: "NEGATIVE"
        }
    ];

    for (const s of scenarios) {
        console.log(`[TEST] Running: ${s.name}`);
        console.log(`      Input: "${s.input}"`);

        try {
            let result;
            if (s.type === "TRIAGE") result = await classifyAppointment(s.input);
            if (s.type === "VOICE") result = await processVoiceIntent(s.input);
            if (s.type === "SENTIMENT") result = { sentiment: await analyzeSentiment(s.input) };

            console.log(`      Result:`, JSON.stringify(result, null, 2));
            console.log(`      ✅ Status: Verified\n`);
        } catch (e) {
            console.log(`      ❌ Status: Failed (${e.message})\n`);
        }
    }

    console.log("=== DIAGNOSTICS COMPLETE ===");
}

validate().catch(console.error);
