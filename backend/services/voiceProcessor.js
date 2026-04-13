const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logAction } = require('./auditService');
const { assertWithinAiLimit, incrementAiUsage } = require('./usageService');

function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

/**
 * Processes a Greek speech transcript from a phone call.
 * Identifies if the user wants to book, cancel, or ask a question.
 */
async function processVoiceIntent(transcript, clinic) {
  try {
    await assertWithinAiLimit(clinic.id);
    const aiConfig = JSON.parse(clinic.aiConfig || '{}');
    const prompt = `
      You are an AI dental receptionist for "${clinic.name}" in ${clinic.location}.
      Clinic Hours: ${JSON.stringify(aiConfig.workingHours || clinic.workingHours)}
      Clinic Services: ${aiConfig.services || 'General Dental Services'}
      Clinic Policies: ${aiConfig.policies || 'Standard clinic policies'}
      AI Tone: ${aiConfig.tone || 'Professional'}
      Average Appointment Value: ${aiConfig.avgAppointmentValue || 150}
      Phone: ${clinic.phone}

      Analyze this transcript from a phone call (in Greek):
      "${transcript}"
      
      Extract the following info in JSON:
      {
        "intent": "BOOK" | "CANCEL" | "INFO" | "UNKNOWN",
        "reason": "short clinical reason in Greek",
        "priority": "URGENT" | "NORMAL",
        "isDateMentioned": boolean,
        "suggestedResponse": "A very polite response in Greek to say to the caller"
      }
      
      Rules:
      - Tooth pain or bleeding is URGENT.
      - Checkup or cleaning is NORMAL.
    `;

    const model = getModel();

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const cleanedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: 'UNKNOWN', suggestedResponse: 'Παρακαλώ επαναλάβετε.' };

    await logAction({
      clinicId: clinic.id,
      action: 'AI_REQUEST',
      entity: 'VOICE_INTENT_PROCESSING',
      entityId: null,
      details: { intent: cleanedResult.intent }
    });
    await incrementAiUsage(clinic.id);

    return cleanedResult;
  } catch (error) {
    console.error('[VoiceProcessor] Error:', error.message);
    // Robust fallback for demos
    const normalized = transcript.toLowerCase();
    const intent = normalized.includes('κλεισ') || normalized.includes('ραντεβ') ? 'BOOK' :
      normalized.includes('ακυρ') ? 'CANCEL' : 'INFO';

    return {
      intent,
      suggestedResponse: intent === 'BOOK' ? 'Βεβαίως, θα χαρούμε να σας κλείσουμε ένα ραντεβού. Πότε σας βολεύει;' : 'Πώς θα μπορούσαμε να σας βοηθήσουμε;',
      data: { intent }
    };
  }
}

module.exports = { processVoiceIntent };
