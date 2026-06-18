const prisma = require('../services/prisma');
const { decryptSafe } = require('../utils/cryptoUtils');
const AppError = require('../errors/AppError');
const crypto = require('crypto');

/**
 * Middleware to validate webhook requests using a per-clinic secret.
 * Webhooks should include a 'x-clinicflow-secret' header.
 */
const validateWebhookSecret = async (req, res, next) => {
    const { clinicId } = req.body;
    const incomingSecret = req.headers['x-clinicflow-secret'];

    if (!clinicId) {
        return next(new AppError('VALIDATION_ERROR', 'clinicId is required for secure webhooks', 400));
    }

    try {
        const clinic = await prisma.clinic.findUnique({
            where: { id: clinicId },
            select: { webhookSecret: true }
        });

        if (!clinic) {
            return next(new AppError('NOT_FOUND', 'Clinic not found', 404));
        }

        const actualSecret = decryptSafe(clinic.webhookSecret);

        // A webhook secret MUST be configured for the clinic and MUST match the incoming secret (fail closed)
        if (!actualSecret) {
            console.warn(`[Security] Webhook received for clinicId=${clinicId} but no webhook secret is configured. Failing closed.`);
            return next(new AppError('UNAUTHORIZED', 'Webhook security is not configured for this clinic', 401));
        }

        if (!incomingSecret || !crypto.timingSafeEqual(
            Buffer.from(String(incomingSecret), 'utf8'),
            Buffer.from(String(actualSecret), 'utf8')
        )) {
            console.warn(`[Security] Invalid webhook secret for clinicId=${clinicId}`);
            return next(new AppError('UNAUTHORIZED', 'Invalid or missing webhook secret', 401));
        }

        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Middleware for global system automations.
 * Validates against the global VAPI_WEBHOOK_SECRET or a fallback MBAS_SYSTEM_SECRET.
 */
const validateSystemSecret = (req, res, next) => {
    // SECURITY: Use a dedicated system secret, NOT the Vapi webhook secret.
    // Reusing secrets across auth domains means compromising one compromises all.
    const systemSecret = process.env.MBAS_SYSTEM_SECRET;
    const incomingSecret = req.headers['x-clinicflow-secret'] || req.headers['x-vapi-secret'];

    if (process.env.NODE_ENV !== 'production' && !systemSecret) {
        return next();
    }

    if (!systemSecret) {
        return next(new AppError('CONFIGURATION_ERROR', 'System secret not configured. Set MBAS_SYSTEM_SECRET.', 500));
    }

    if (!incomingSecret || !crypto.timingSafeEqual(
        Buffer.from(String(incomingSecret), 'utf8'),
        Buffer.from(String(systemSecret), 'utf8')
    )) {
        console.warn('[Security] Unauthorized global automation attempt');
        return next(new AppError('UNAUTHORIZED', 'Invalid system secret', 401));
    }

    next();
};

module.exports = { validateWebhookSecret, validateSystemSecret };
