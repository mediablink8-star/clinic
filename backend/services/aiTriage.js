const { GoogleGenerativeAI } = require('@google/generative-ai');
const { assertWithinAiLimit, incrementAiUsage } = require('./usageService');
const { logAction } = require('./auditService');
const logger = require('../utils/logger');

function getModel(apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Gemini API key available');
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

function classifyRuleBased(reason) {
    const normalized = reason.toLowerCase();
    const isUrgent = normalized.includes('πον') ||
        normalized.includes('σπασ') ||
        normalized.includes('αιμ') ||
        normalized.includes('ματ') ||
        normalized.includes('εμποδ') ||
        normalized.includes('πρηξ');

    return {
        priority: isUrgent ? 'URGENT' : 'NORMAL',
        greekSummary: isUrgent ? 'Επείγον περιστατικό (Πόνος/Τραύμα)' : 'Προγραμματισμένος έλεγχος / Καθαρισμός'
    };
}

async function classifyAppointment(reason, clinic) {
    try {
        const { degraded } = await assertWithinAiLimit(clinic.id);

        if (degraded) {
            return classifyRuleBased(reason);
        }

        let servicesList = '';
        try { servicesList = JSON.parse(clinic.services || '[]').map(s => s.name).join(', '); } catch {}
        const aiConfig = JSON.parse(clinic.aiConfig || '{}');

        const { decrypt } = require('./encryptionService');
        const clinicGeminiKey = clinic.geminiApiKey ? decrypt(clinic.geminiApiKey) : null;

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

        const model = getModel(clinicGeminiKey);
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

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
        if (error.code === 'RATE_LIMITED') throw error;
        logger.error('Gemini error, using fallback', { error: error.message });
        return classifyRuleBased(reason);
    }
}

module.exports = { classifyAppointment };
