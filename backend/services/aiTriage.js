const { GoogleGenerativeAI } = require('@google/generative-ai');
const { logAction } = require('./auditService');
const { assertWithinAiLimit, incrementAiUsage } = require('./usageService');

/**
 * Initializes the Gemini client with a specific API key.
 * @param {string} apiKey - The raw (decrypted) API key.
 * @returns {object} - The generative model instance.
 */
function getModel() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

/**
 * Classifies a dental appointment reason into 'URGENT' or 'NORMAL'
 * and provides a Greek summary using Google Gemini.
 * @param {string} reason - The appointment reason
 * @param {object} clinic - The clinic context object
 */
async function classifyAppointment(reason, clinic) {
    try {
        await assertWithinAiLimit(clinic.id);
        const servicesList = JSON.parse(clinic.services).map(s => s.name).join(', ');
        const aiConfig = JSON.parse(clinic.aiConfig || '{}');

        const prompt = `
      You are an expert dental receptionist at "${clinic.name}" in ${clinic.location}.
      Clinic Services: ${aiConfig.services || servicesList}.
      Clinic Policies: ${aiConfig.policies || 'None specified'}.
      Tone: ${aiConfig.tone || 'Professional'}.
      
      Classify the following appointment reason into one of these categories: URGENT, NORMAL.
      
      Common urgent reasons: tooth pain, bleeding, broken tooth, abscess.
      Common normal reasons: whitening, cleaning, checkup, orthodontic adjustment.
      
      Reason: "${reason}"
      
      Return the result in JSON format:
      {
        "priority": "URGENT" | "NORMAL",
        "greekSummary": "A very short Greek summary of the issue"
      }
    `;

        const model = getModel();

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract JSON from potential markdown blocks
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const cleanedResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(responseText);

        await logAction({
            clinicId: clinic.id,
            action: 'AI_REQUEST',
            entity: 'APPOINTMENT_CLASSIFICATION',
            entityId: null,
            details: { priority: cleanedResult.priority }
        });
        await incrementAiUsage(clinic.id);

        return cleanedResult;
    } catch (error) {
        console.error('Gemini error, using fallback:', error.message);
        // Realistic fallback for mock data
        const normalized = reason.toLowerCase();
        // Better Greek keyword matching for roots
        const isUrgent = normalized.includes('πον') || // πονάει, πόνος
            normalized.includes('σπασ') || // έσπασε, σπασμένο
            normalized.includes('αιμ') || // αίμα, αιμορραγία, ματώνει 
            normalized.includes('ματ') || // ματώνει
            normalized.includes('εμποδ') || // εμπόδιο
            normalized.includes('πρηξ'); // πρήξιμο

        return {
            priority: isUrgent ? 'URGENT' : 'NORMAL',
            greekSummary: isUrgent ? 'Επείγον περιστατικό (Πόνος/Τραύμα)' : 'Προγραμματισμένος έλεγχος / Καθαρισμός'
        };
    }
}

module.exports = { classifyAppointment };

