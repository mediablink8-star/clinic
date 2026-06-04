const crypto = require('crypto');
const { verifyToken } = require('../services/authService');
const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const asyncHandler = require('./asyncHandler');
const logger = require('../utils/logger');

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
            logger.error('AUTOMATION_API_KEY is not set on server');
            throw new AppError('NO_API_KEY_CONFIGURED', 'AUTOMATION_API_KEY is not set on this server', 401);
        }

        // Timing-safe comparison to prevent timing attacks
        const envKeyBuffer = Buffer.from(envKey, 'utf8');
        const apiKeyBuffer = Buffer.from(apiKey, 'utf8');
        if (envKeyBuffer.length !== apiKeyBuffer.length || !crypto.timingSafeEqual(envKeyBuffer, apiKeyBuffer)) {
            logger.warn('Invalid API Key attempt');
            throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
        }

        // API key auth doesn't have a user context — set a sentinel so downstream services know
        req.user = { userId: 'automation', role: 'AUTOMATION' };

        // Only accept clinicId from the request if the caller explicitly provides it.
        // SECURITY: If AUTOMATION_ALLOWED_CLINIC_IDS is set (comma-separated),
        // the caller can only access those specific clinics.
        // This prevents multi-tenant access via a shared global API key.
        const requestedClinicId = req.body?.clinicId || req.query?.clinicId || null;
        if (!requestedClinicId) {
            throw new AppError('FORBIDDEN', 'Access denied: clinicId is required for API key authentication', 403);
        }
        req.clinicId = requestedClinicId;

        const allowedIds = process.env.AUTOMATION_ALLOWED_CLINIC_IDS;
        if (!allowedIds) {
            logger.warn('API key used but AUTOMATION_ALLOWED_CLINIC_IDS is empty — failing closed');
            throw new AppError('FORBIDDEN', 'API access is disabled: no clinics are allowed', 403);
        }

        const allowed = allowedIds.split(',').map(id => id.trim()).filter(Boolean);
        if (allowed.length === 0 || !allowed.includes(requestedClinicId)) {
            logger.warn('API key attempted access to non-allowed clinic', { clinicId: requestedClinicId });
            throw new AppError('FORBIDDEN', 'This API key does not have access to the requested clinic', 403);
        }

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
