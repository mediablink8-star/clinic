const crypto = require('crypto');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');

// KNOWN_CLINIC_IDS is an OPTIONAL defense-in-depth allowlist. Empty (the default)
// means "no clinic is restricted" — any caller with a valid WEBHOOK_SECRET or
// HMAC signature is accepted. Set it as a comma-separated list of Clinic CUIDs
// ONLY if you have third-party services that call /api/automation/* directly
// (e.g. a partner integration acting on behalf of specific clinics). Your
// n8n workflows use HMAC signatures and are not affected by this list — they
// work fine with it empty. Operators do NOT need to update this per onboarding.
const KNOWN_CLINIC_IDS = process.env.KNOWN_CLINIC_IDS
    ? process.env.KNOWN_CLINIC_IDS.split(',').map(id => id.trim())
    : [];

// Zadarma doesn't send custom auth headers. We use a secret in the URL path instead.
// Auto-generate one at startup if not set, and surface it so the operator can
// paste it into the Zadarma panel.
let zadarmaSecret = process.env.ZADARMA_WEBHOOK_SECRET;
if (!zadarmaSecret) {
    if (process.env.NODE_ENV === 'production') {
        zadarmaSecret = crypto.randomBytes(24).toString('hex');
        // Print to stderr so the operator can see it in deployment logs without
        // it being persisted in structured log aggregation (where it could leak).
        // Never include the secret in a logger call that might go to log storage.
        process.stderr.write(
            `[ZADARMA] WARNING: ZADARMA_WEBHOOK_SECRET not set — auto-generated for this process.\n` +
            `[ZADARMA] Set this in your env to keep it stable across restarts:\n` +
            `[ZADARMA] ZADARMA_WEBHOOK_SECRET=${zadarmaSecret}\n`
        );
    } else {
        zadarmaSecret = 'dev-zadarma-secret';
        logger.warn('ZADARMA_WEBHOOK_SECRET not set — using insecure dev default. Set it in env for production.');
    }
}

function timingSafeEqualStr(a, b) {
    const aBuf = Buffer.from(String(a), 'utf8');
    const bBuf = Buffer.from(String(b), 'utf8');
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Middleware that validates the Zadarma secret in the URL path.
 * Mounted at /zadarma/:secret
 */
function validateZadarmaSecret(req, res, next) {
    const provided = req.params.secret;
    if (!provided) {
        return next(new AppError('UNAUTHORIZED', 'Zadarma webhook secret missing in URL', 401));
    }
    if (!timingSafeEqualStr(provided, zadarmaSecret)) {
        return next(new AppError('UNAUTHORIZED', 'Invalid Zadarma webhook secret', 401));
    }
    return next();
}

/**
 * Webhook authentication middleware.
 * Supports two modes:
 *  1. Simple secret header: x-webhook-secret must match WEBHOOK_SECRET env var
 *  2. HMAC signature: x-webhook-signature must be a valid HMAC-SHA256 of the raw body
 *
 * If WEBHOOK_SECRET is not set, the request is allowed through with a warning log.
 */
const asyncHandler = require('./asyncHandler');

module.exports = asyncHandler(async function webhookAuth(req, res, next) {
    const envSecret = process.env.WEBHOOK_SECRET;

    if (!envSecret) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError('CONFIGURATION_ERROR', 'Webhook authentication not configured', 500);
        }
        console.warn('[WEBHOOK] WARNING: WEBHOOK_SECRET not set. Webhooks running in insecure mode.');
        return next();
    }

    // Mode 1: simple secret header (x-webhook-secret, x-api-key, or x-webhook-key)
    const headerSecret = req.headers['x-webhook-secret'] 
                      || req.headers['x-api-key'] 
                      || req.headers['x-webhook-key'];
    if (headerSecret) {
        const hBuf = Buffer.from(headerSecret);
        const sBuf = Buffer.from(envSecret);
        if (hBuf.length === sBuf.length && crypto.timingSafeEqual(hBuf, sBuf)) {
            // Check clinicId allowlist if provided
            if (KNOWN_CLINIC_IDS.length > 0 && req.body?.clinicId) {
                if (!KNOWN_CLINIC_IDS.includes(req.body.clinicId)) {
                    throw new AppError('FORBIDDEN', 'Clinic not allowed', 403);
                }
            }
            return next();
        }
        throw new AppError('UNAUTHORIZED', 'Invalid webhook secret', 401);
    }

    // Mode 2: HMAC-SHA256 signature header (sent by our own triggerWebhook)
    const signature = req.headers['x-webhook-signature'];
    if (signature) {
        // Use raw body if available, fallback to JSON stringified body
        const body = req.rawBody || JSON.stringify(req.body);
        const expected = crypto
            .createHmac('sha256', envSecret)
            .update(body)
            .digest('hex');
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expected);
        if (signatureBuffer.length !== expectedBuffer.length) {
            throw new AppError('UNAUTHORIZED', 'Invalid webhook signature', 401);
        }
        if (crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            // Check clinicId allowlist if provided
            if (KNOWN_CLINIC_IDS.length > 0 && req.body?.clinicId) {
                if (!KNOWN_CLINIC_IDS.includes(req.body.clinicId)) {
                    throw new AppError('FORBIDDEN', 'Clinic not allowed', 403);
                }
            }
            return next();
        }
        throw new AppError('UNAUTHORIZED', 'Invalid webhook signature', 401);
    }

    throw new AppError('UNAUTHORIZED', 'Missing webhook authentication', 401);
});

module.exports.validateZadarmaSecret = validateZadarmaSecret;
module.exports.getZadarmaSecret = () => zadarmaSecret;