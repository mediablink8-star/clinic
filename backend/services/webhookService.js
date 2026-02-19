/**
 * Service to trigger external workflows via n8n/Make webhooks.
 * Now dynamic: Requires 'webhookUrl' to be passed from the Clinic object.
 */

const crypto = require('crypto');

async function triggerWebhook(eventType, payload, webhookUrl, webhookSecret) {
    if (!webhookUrl) {
        console.log(`[Webhook] Skipped: No webhookUrl configured for this clinic.`);
        return false;
    }

    try {
        console.log(`[Webhook] Triggering event: ${eventType} to ${webhookUrl}`);

        const body = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
        });

        // Generate HMAC signature if secret is provided
        const headers = { 'Content-Type': 'application/json' };
        if (webhookSecret) {
            const signature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }

        // Fire and forget (don't block the main thread)
        fetch(webhookUrl, {
            method: 'POST',
            headers,
            body
        }).catch(err => {
            console.error(`[Webhook] Failed to send event ${eventType}:`, err.message);
        });

        return true;
    } catch (error) {
        console.error('[Webhook] Error:', error.message);
        return false;
    }
}

module.exports = { triggerWebhook };
