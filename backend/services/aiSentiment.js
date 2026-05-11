const { GoogleGenerativeAI } = require('@google/generative-ai');
const { assertWithinAiLimit, incrementAiUsage } = require('./usageService');

function getModel(apiKey) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error('No Gemini API key available');
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
}
/**
 * Analyzes Greek feedback text and returns POSITIVE, NEUTRAL, or NEGATIVE.
 * @param {string} text - The feedback text
 * @param {object} clinic - The clinic context object
 */
async function analyzeSentiment(text, clinic) {
    if (!text || text.length < 5) return 'NEUTRAL';

    try {
        await assertWithinAiLimit(clinic.id);

        // Use per-clinic Gemini key if set, fall back to global
        const { decrypt } = require('./encryptionService');
        const clinicGeminiKey = clinic.geminiApiKey ? decrypt(clinic.geminiApiKey) : null;

        const prompt = `
      You are an expert customer experience analyst for "${clinic.name}".
      Analyze the following dental clinic feedback and classify it as: POSITIVE, NEUTRAL, or NEGATIVE.
      
      Feedback: "${text}"
      
      Return ONLY the word (POSITIVE, NEUTRAL, or NEGATIVE).
    `;

        const model = getModel(clinicGeminiKey);

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim().toUpperCase();
        await incrementAiUsage(clinic.id);

        if (response.includes('POSITIVE')) return 'POSITIVE';
        if (response.includes('NEGATIVE')) return 'NEGATIVE';
        return 'NEUTRAL';
    } catch (error) {
        if (error.code === 'USAGE_LIMIT_REACHED' || error.code === 'RATE_LIMITED') {
            throw error;
        }
        console.error('Sentiment analysis error:', error);
        const normalized = text.toLowerCase();
        if (normalized.includes('καλ') || normalized.includes('ευχαριστ') || normalized.includes('τελει')) return 'POSITIVE';
        if (normalized.includes('κακ') || normalized.includes('ακριβ') || normalized.includes('αργ')) return 'NEGATIVE';
        return 'NEUTRAL';
    }
}

module.exports = { analyzeSentiment };
