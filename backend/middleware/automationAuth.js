const crypto = require('crypto');
const { verifyToken } = require('../services/authService');
const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const asyncHandler = require('./asyncHandler');

/**
 * Automation auth middleware.
 * Accepts either:
 *   1. Bearer JWT (same as requireAuth) — for dashboard-triggered calls
 *   2. x-api-key header matching AUTOMATION_API_KEY env var — for n8n / Make
 *
 * If neither is present or valid, returns 401.
 */
module.exports = asyncHandler(async function automationAuth(req, res, next) {
    // Mode 1: API key (workflow tools)
    const apiKey = req.headers['x-api-key'] || req.headers['x-webhook-key'];
    if (apiKey) {
        const envKey = process.env.AUTOMATION_API_KEY;
        if (!envKey) {
            throw new AppError('NO_API_KEY_CONFIGURED', 'AUTOMATION_API_KEY is not set on this server', 401);
        }
        // Timing-safe comparison to prevent timing attacks
        try {
            const match = crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(envKey));
            if (!match) throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
        } catch {
            throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
        }
        // API key auth doesn't have a user context — set a sentinel so downstream services know
        req.user = { userId: 'automation', role: 'AUTOMATION' };
        req.clinicId = req.body?.clinicId || req.query?.clinicId || null;
        // Verify clinic exists and is active when clinicId is provided
        if (req.clinicId) {
            const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
            if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
            if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'Clinic is not active', 403);
            req.clinic = clinic;
        }
        return next();
    }

    // Mode 2: Bearer JWT (same as requireAuth)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            throw new AppError('INVALID_TOKEN', 'Invalid or expired token', 401);
        }
        req.user = decoded;
        req.clinicId = decoded.clinicId;

        const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
        if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
        if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'Clinic is not active', 403);
        req.clinic = clinic;
        return next();
    }

    throw new AppError('UNAUTHORIZED', 'Missing authentication', 401);
});
