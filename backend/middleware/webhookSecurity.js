const prisma = require('../services/prisma');
const { decrypt } = require('../services/encryptionService');
const AppError = require('../errors/AppError');

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

        const decryptSafe = (val) => {
            if (!val) return null;
            try {
                if (val.includes(':')) return decrypt(val);
                return val;
            } catch (e) { return val; }
        };

        const actualSecret = decryptSafe(clinic.webhookSecret);

        // A webhook secret MUST be configured for the clinic and MUST match the incoming secret (fail closed)
        if (!actualSecret) {
            console.warn(`[Security] Webhook received for clinicId=${clinicId} but no webhook secret is configured. Failing closed.`);
            return next(new AppError('UNAUTHORIZED', 'Webhook security is not configured for this clinic', 401));
        }

        if (!incomingSecret || incomingSecret !== actualSecret) {
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
    const systemSecret = process.env.VAPI_WEBHOOK_SECRET || process.env.MBAS_SYSTEM_SECRET;
    const incomingSecret = req.headers['x-clinicflow-secret'] || req.headers['x-vapi-secret'];

    if (process.env.NODE_ENV !== 'production' && !systemSecret) {
        return next();
    }

    if (!systemSecret) {
        return next(new AppError('CONFIGURATION_ERROR', 'System secret not configured', 500));
    }

    if (!incomingSecret || incomingSecret !== systemSecret) {
        console.warn('[Security] Unauthorized global automation attempt');
        return next(new AppError('UNAUTHORIZED', 'Invalid system secret', 401));
    }

    next();
};

module.exports = { validateWebhookSecret, validateSystemSecret };
