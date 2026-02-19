const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const clinic = require('../config/clinic.json');

/**
 * Processes a Greek speech transcript from a phone call.
 * Identifies if the user wants to book, cancel, or ask a question.
 */
async function processVoiceIntent(transcript) {
  try {
    const prompt = `
      You are an AI dental receptionist for "${clinic.name}" in ${clinic.location}.
      Clinic Hours: ${JSON.stringify(clinic.workingHours)}
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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: 'UNKNOWN', suggestedResponse: 'Παρακαλώ επαναλάβετε.' };
  } catch (error) {
    console.error('Voice processing error detailed:', error);
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
