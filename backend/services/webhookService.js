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
 * Builds a sanitized clinic context object safe to include in outbound webhook payloads.
 * Strips sensitive fields (apiKeys, webhookSecret, etc.) before sending.
 * @param {object} clinic - Prisma Clinic record
 * @returns {object}
 */
function buildClinicContext(clinic) {
    if (!clinic) return null;
    return {
        id: clinic.id,
        name: clinic.name,
        phone: clinic.phone,
        location: clinic.location,
        services: (() => { try { return JSON.parse(clinic.services || '[]'); } catch { return []; } })(),
        workingHours: (() => { try { return JSON.parse(clinic.workingHours || '{}'); } catch { return {}; } })(),
        policies: (() => { try { return JSON.parse(clinic.policies || '{}'); } catch { return {}; } })(),
        aiConfig: (() => { try { return JSON.parse(clinic.aiConfig || '{}'); } catch { return {}; } })(),
    };
}

/**
 * Resolves the target webhook URL for a given event based on clinic overrides.
 */
function resolveWebhookUrl(eventType, clinic) {
    if (!clinic) return null;
    
    // Event specific overrides
    if (eventType.startsWith('missed_call') && clinic.webhookMissedCall) return clinic.webhookMissedCall;
    if (eventType.startsWith('appointment') && clinic.webhookAppointment) return clinic.webhookAppointment;
    if (eventType.startsWith('notification') && clinic.webhookReminders) return clinic.webhookReminders;
    if (eventType === 'message.direct_send' && clinic.webhookDirectSms) return clinic.webhookDirectSms;
    if (eventType === 'message.inbound' && clinic.webhookInboundSms) return clinic.webhookInboundSms;
    
    // Default global URL
    return clinic.webhookUrl;
}

/**
 * Triggers an external webhook with automatic retry (exponential backoff).
 * @param {string} eventType
 * @param {object} payload
 * @param {string} webhookUrl - If null, will attempt to resolve from clinic context
 * @param {string} [webhookSecret]
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.baseDelay=500]  ms
 * @param {object} [options.clinic]         Full clinic object — included as `clinic` in payload
 */
async function triggerWebhook(eventType, payload, webhookUrl, webhookSecret, options = {}) {
    const { clinic } = options;
    
    // If webhookUrl is not explicitly provided, or if it's the global one, 
    // try to resolve a more specific one from the clinic config.
    const targetUrl = webhookUrl || resolveWebhookUrl(eventType, clinic);

    if (!targetUrl) {
        console.log(`[Webhook] Skipped: No webhookUrl configured for event ${eventType}.`);
        return { success: false, reason: 'No URL' };
    }

    const { maxRetries = 3, baseDelay = 500 } = options;

    const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
        ...(clinic ? { clinic: buildClinicContext(clinic) } : {})
    });

    const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' };
    const secret = webhookSecret || clinic?.webhookSecret;
    if (secret) {
        headers['X-Webhook-Signature'] = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex');
    }

    const startTime = Date.now();
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Webhook] ${eventType} → attempt ${attempt}/${maxRetries} to ${targetUrl}`);
            await sendOnce(targetUrl, body, headers);
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

/**
 * Forwards an inbound message (e.g. from WhatsApp) to the clinic's configured webhook URL.
 * Used by POST /api/webhooks/whatsapp and similar inbound routes.
 *
 * @param {object} params
 * @param {string} params.from        - Sender phone number
 * @param {string} params.body        - Message text
 * @param {string} params.provider    - 'sms' | 'whatsapp' | etc.
 * @param {object} params.clinic      - Full Prisma clinic record
 * @param {object} [params.raw]       - Raw provider payload (optional, for debugging)
 */
async function forwardInboundMessage({ from, body, provider, clinic, raw }) {
    return triggerWebhook(
        'message.inbound',
        { from, body, provider, raw: raw || null },
        clinic.webhookUrl,
        clinic.webhookSecret,
        { maxRetries: 3, baseDelay: 500, clinic }
    );
}

module.exports = { triggerWebhook, forwardInboundMessage, buildClinicContext };
