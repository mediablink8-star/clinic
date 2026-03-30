const { verifyToken } = require('../services/authService');
const prisma = require('../services/prisma');

/**
 * Automation auth middleware.
 * Accepts either:
 *   1. Bearer JWT (same as requireAuth) — for dashboard-triggered calls
 *   2. x-api-key header matching AUTOMATION_API_KEY env var — for n8n / Make
 *
 * If neither is present or valid, returns 401.
 */
module.exports = async function automationAuth(req, res, next) {
    // Mode 1: API key (workflow tools)
    const apiKey = req.headers['x-api-key'];
    if (apiKey) {
        const envKey = process.env.AUTOMATION_API_KEY;
        if (!envKey) {
            return res.status(401).json({ error: { code: 'NO_API_KEY_CONFIGURED', message: 'AUTOMATION_API_KEY is not set on this server' } });
        }
        if (apiKey !== envKey) {
            return res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'Invalid API key' } });
        }
        // API key auth doesn't have a user context — set a sentinel so downstream services know
        req.user = { userId: 'automation', role: 'AUTOMATION' };
        req.clinicId = req.body?.clinicId || req.query?.clinicId || null;
        return next();
    }

    // Mode 2: Bearer JWT (same as requireAuth)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
        }
        req.user = decoded;
        req.clinicId = decoded.clinicId;

        const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
        if (!clinic) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Clinic not found' } });
        req.clinic = clinic;
        return next();
    }

    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing authentication' } });
};
