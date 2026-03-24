const crypto = require('crypto');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Sends a single webhook attempt.
 */
async function sendOnce(webhookUrl, body, headers) {
    const response = await fetch(webhookUrl, { method: 'POST', headers, body });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
}

/**
 * Triggers an external webhook with automatic retry (exponential backoff).
 * @param {string} eventType
 * @param {object} payload
 * @param {string} webhookUrl
 * @param {string} [webhookSecret]
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.baseDelay=500]  ms
 */
async function triggerWebhook(eventType, payload, webhookUrl, webhookSecret, options = {}) {
    if (!webhookUrl) {
        console.log(`[Webhook] Skipped: No webhookUrl configured.`);
        return { success: false, reason: 'No URL' };
    }

    const { maxRetries = 3, baseDelay = 500 } = options;

    const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload
    });

    const headers = { 'Content-Type': 'application/json' };
    if (webhookSecret) {
        headers['X-Webhook-Signature'] = crypto
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');
    }

    const startTime = Date.now();
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Webhook] ${eventType} → attempt ${attempt}/${maxRetries}`);
            await sendOnce(webhookUrl, body, headers);
            const duration = Date.now() - startTime;
            console.log(`[Webhook] ${eventType} delivered in ${duration}ms (attempt ${attempt})`);
            return { success: true, duration, attempts: attempt };
        } catch (err) {
            lastError = err;
            console.warn(`[Webhook] ${eventType} attempt ${attempt} failed: ${err.message}`);
            if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt - 1); // 500, 1000, 2000...
                console.log(`[Webhook] Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    const duration = Date.now() - startTime;
    console.error(`[Webhook] ${eventType} failed after ${maxRetries} attempts: ${lastError.message}`);
    return { success: false, error: lastError.message, duration, attempts: maxRetries };
}

module.exports = { triggerWebhook };
