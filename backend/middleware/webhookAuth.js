const crypto = require('crypto');

/**
 * Webhook authentication middleware.
 * Supports two modes:
 *  1. Simple secret header: x-webhook-secret must match WEBHOOK_SECRET env var
 *  2. HMAC signature: x-webhook-signature must be a valid HMAC-SHA256 of the raw body
 *
 * If WEBHOOK_SECRET is not set, the request is allowed through with a warning log.
 */
module.exports = function webhookAuth(req, res, next) {
    const envSecret = process.env.WEBHOOK_SECRET;

    if (!envSecret) {
        console.error('[WEBHOOK] CRITICAL: WEBHOOK_SECRET not set. Webhook endpoints are disabled for security.');
        return res.status(500).json({ 
            error: 'Server configuration error', 
            code: 'MISSING_WEBHOOK_SECRET',
            message: 'Webhook security is not configured on the server.'
        });
    }

    // Mode 1: simple secret header
    const headerSecret = req.headers['x-webhook-secret'];
    if (headerSecret) {
        if (headerSecret === envSecret) return next();
        return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    // Mode 2: HMAC-SHA256 signature header (sent by our own triggerWebhook)
    const signature = req.headers['x-webhook-signature'];
    if (signature) {
        const body = JSON.stringify(req.body);
        const expected = crypto
            .createHmac('sha256', envSecret)
            .update(body)
            .digest('hex');
        if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return next();
        }
        return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    return res.status(401).json({ error: 'Missing webhook authentication' });
};
