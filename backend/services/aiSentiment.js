const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
/**
 * Analyzes Greek feedback text and returns POSITIVE, NEUTRAL, or NEGATIVE.
 * @param {string} text - The feedback text
 * @param {object} clinic - The clinic context object
 */
async function analyzeSentiment(text, clinic) {
    if (!text || text.length < 5) return 'NEUTRAL';

    try {
        const prompt = `
      You are an expert customer experience analyst for "${clinic.name}".
      Analyze the following dental clinic feedback and classify it as: POSITIVE, NEUTRAL, or NEGATIVE.
      
      Feedback: "${text}"
      
      Return ONLY the word (POSITIVE, NEUTRAL, or NEGATIVE).
    `;

        const result = await model.generateContent(prompt);
        const response = result.response.text().trim().toUpperCase();

        if (response.includes('POSITIVE')) return 'POSITIVE';
        if (response.includes('NEGATIVE')) return 'NEGATIVE';
        return 'NEUTRAL';
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        // Robust fallback
        const normalized = text.toLowerCase();
        if (normalized.includes('καλ') || normalized.includes('ευχαριστ') || normalized.includes('τελει')) return 'POSITIVE';
        if (normalized.includes('κακ') || normalized.includes('ακριβ') || normalized.includes('αργ')) return 'NEGATIVE';
        return 'NEUTRAL';
    }
}

module.exports = { analyzeSentiment };
