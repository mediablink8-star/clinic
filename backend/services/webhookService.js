/**
 * Service to trigger external workflows via n8n/Make webhooks.
 * Now dynamic: Requires 'webhookUrl' to be passed from the Clinic object.
 */

const crypto = require('crypto');

async function triggerWebhook(eventType, payload, webhookUrl, webhookSecret, options = {}) {
    if (!webhookUrl) {
        console.log(`[Webhook] Skipped: No webhookUrl configured for this clinic.`);
        return { success: false, reason: 'No URL' };
    }

    const startTime = Date.now();
    try {
        console.log(`[Webhook] Triggering event: ${eventType} to ${webhookUrl}`);

        const body = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
        });

        const headers = { 'Content-Type': 'application/json' };
        if (webhookSecret) {
            const signature = crypto
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('hex');
            headers['X-Webhook-Signature'] = signature;
        }

        const fetchPromise = fetch(webhookUrl, {
            method: 'POST',
            headers,
            body
        });

        if (options.awaitResponse) {
            const response = await fetchPromise;
            const duration = Date.now() - startTime;
            return {
                success: response.ok,
                status: response.status,
                duration,
                message: response.ok ? 'Webhook delivered' : `HTTP ${response.status}`
            };
        } else {
            // Original fire-and-forget behavior
            fetchPromise.catch(err => {
                console.error(`[Webhook] Failed to send event ${eventType}:`, err.message);
            });
            return { success: true, duration: 0 };
        }
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[Webhook] Error:', error.message);
        return { success: false, error: error.message, duration };
    }
}

module.exports = { triggerWebhook };
