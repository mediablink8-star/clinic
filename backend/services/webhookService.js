const crypto = require('crypto');
const logger = require('../utils/logger');
const { decrypt } = require('./encryptionService');
const prisma = require('./prisma');

const decryptSafe = (val) => {
    if (!val) return null;
    try {
        if (val.includes(':')) {
            return decrypt(val);
        }
        return val;
    } catch (e) {
        return val;
    }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Sends a single webhook attempt with timeout.
 */
async function sendOnce(webhookUrl, body, headers, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(webhookUrl, { 
            method: 'POST', 
            headers, 
            body,
            signal: controller.signal 
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Builds a sanitized clinic context object safe to include in outbound webhook payloads.
 * Strips sensitive fields before sending.
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
 * Resolves the target webhook URL for a given event based on clinic overrides or global N8N fallback.
 */
function resolveWebhookUrl(eventType, clinic) {
    let url = null;
    if (clinic) {
        // Strip ".test" suffix for test events so they resolve to the real URL
        const baseType = eventType.replace(/\.test$/, '');

        // Event specific overrides from Database
        if (baseType.startsWith('missed_call') && clinic.webhookMissedCall) url = clinic.webhookMissedCall;
        else if (baseType.startsWith('appointment') && clinic.webhookAppointment) url = clinic.webhookAppointment;
        else if (baseType.startsWith('notification') && clinic.webhookReminders) url = clinic.webhookReminders;
        else if (baseType === 'message.direct_send') url = clinic.webhookDirectSms || clinic.webhookUrl;
        else if (baseType === 'message.inbound') url = clinic.webhookInboundSms || clinic.webhookUrl;
        else if (baseType === 'review_request' && (clinic.webhookReviewRequest || clinic.webhookReminders)) url = clinic.webhookReviewRequest || clinic.webhookReminders;
        else url = clinic.webhookUrl;
    }

    // Global N8N Fallback if no URL set in Database
    if (!url && process.env.N8N_WEBHOOK_URL) {
        const base = process.env.N8N_WEBHOOK_URL.replace(/\/$/, '');
        const baseType = eventType.replace(/\.test$/, '');
        // n8n production webhook URLs are at /webhook/<workflow-path>, so
        // every ClinicFlow event maps to a workflow named <event>.
        if (baseType.startsWith('appointment')) return `${base}/webhook/appointment-confirmation`;
        if (baseType === 'message.direct_send') return `${base}/webhook/send-sms`;
        if (baseType === 'message.inbound') return `${base}/webhook/inbound-sms`;
        if (baseType.startsWith('missed_call')) return `${base}/webhook/missed-call`;
        if (baseType.startsWith('notification')) return `${base}/webhook/appointment-reminder`;
        if (baseType === 'review_request') return `${base}/webhook/review-request`;
        return base;
    }

    return url;
}

/**
 * Triggers an external webhook with automatic retry (exponential backoff).
 */
async function triggerWebhook(eventType, payload, webhookUrl, webhookSecret, options = {}) {
     const { clinic } = options;
     const targetUrl = webhookUrl || resolveWebhookUrl(eventType, clinic);

     if (!targetUrl) {
         logger.warn('Webhook Skipped — No target URL found', { eventType });
         return { success: false, reason: 'No URL' };
     }

    // Validate URL to prevent SSRF
    try {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            logger.warn('Webhook Skipped — Invalid protocol', { eventType });
            return { success: false, reason: 'Invalid URL protocol' };
        }
        // Block private/internal IP ranges to prevent SSRF attacks.
        // Override: set ALLOW_PRIVATE_WEBHOOK_URLS=true in env if your n8n
        // VPS resolves to a private IP (rare; usually a public hostname is fine).
        const allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOK_URLS === 'true';
        if (!allowPrivate) {
            const hostname = parsed.hostname.toLowerCase();
            const isPrivateIp = /^10\./.test(hostname) ||
                /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
                /^192\.168\./.test(hostname) ||
                /^127\./.test(hostname) ||
                hostname === 'localhost' ||
                hostname === '0.0.0.0' ||
                /^169\.254\./.test(hostname) || // AWS metadata
                /^::1$/.test(hostname) ||
                /^\[::1\]/.test(hostname);
            if (isPrivateIp) {
                logger.warn('Webhook Skipped — Private/internal IP blocked (set ALLOW_PRIVATE_WEBHOOK_URLS=true to override)', { eventType, hostname });
                return { success: false, reason: 'Private IP blocked' };
            }
        }
    } catch {
        logger.warn('Webhook Skipped — Malformed URL', { eventType });
        return { success: false, reason: 'Malformed URL' };
    }

    const { maxRetries = 3, baseDelay = 500 } = options;
    const rawSecret = webhookSecret || clinic?.webhookSecret;
    const secret = decryptSafe(rawSecret);

    const body = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
        backendUrl: process.env.BACKEND_API_URL || '',
        ...(clinic ? { clinic: buildClinicContext(clinic) } : {})
    });

    const headers = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Webhook-Key': secret || '',
        'ngrok-skip-browser-warning': 'true'
    };

    if (secret) {
        headers['X-Webhook-Signature'] = crypto.createHmac('sha256', secret).update(body).digest('hex');
    }

    logger.info('Webhook Sending', { eventType, targetUrl });

    const startTime = Date.now();
    let lastError;
    let lastHttpStatus = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // Using a more robust request helper to handle potential Node version issues
            const status = await performRequest(targetUrl, body, headers);
            lastHttpStatus = status;
            logger.info('Webhook success', { eventType, attempt, status });
            await recordDelivery({
                clinicId: clinic?.id,
                eventType,
                targetUrl,
                success: true,
                attempts: attempt,
                httpStatus: status,
                durationMs: Date.now() - startTime,
                payload,
            });
            return { success: true, duration: Date.now() - startTime, latency: Date.now() - startTime, attempts: attempt, httpStatus: status };
        } catch (err) {
            lastError = err;
            const m = /HTTP (\d+)/.exec(err.message || '');
            if (m) lastHttpStatus = Number(m[1]);
            logger.warn('Webhook Attempt failed', { eventType, attempt, error: err.message });
            if (attempt < maxRetries) {
                await sleep(baseDelay * Math.pow(2, attempt - 1));
            }
        }
    }

    logger.error('Webhook failed', { event: eventType, url: targetUrl, attempts: maxRetries, err: lastError });
    await recordDelivery({
        clinicId: clinic?.id,
        eventType,
        targetUrl,
        success: false,
        attempts: maxRetries,
        httpStatus: lastHttpStatus,
        errorMessage: lastError?.message,
        durationMs: Date.now() - startTime,
        payload,
    });
    return { success: false, error: lastError.message, duration: Date.now() - startTime, latency: Date.now() - startTime, attempts: maxRetries, httpStatus: lastHttpStatus };
}

/**
 * Persist a single delivery attempt to the WebhookDelivery log. Never throws
 * — a logging failure must not break the calling code path.
 */
async function recordDelivery({ clinicId, eventType, targetUrl, success, attempts, httpStatus, errorMessage, durationMs, payload }) {
    if (!clinicId) return; // System-level calls (no clinic context) are not logged per-clinic
    try {
        // Truncate payload to keep the table light (last 4KB is enough for debug)
        const safePayload = payload && Object.keys(payload).length > 0
            ? { ...payload, _truncated: Buffer.byteLength(JSON.stringify(payload)) > 4096 }
            : null;
        await prisma.webhookDelivery.create({
            data: {
                clinicId,
                eventType,
                targetUrl: targetUrl.length > 500 ? targetUrl.slice(0, 500) : targetUrl,
                success,
                attempts,
                httpStatus: httpStatus || null,
                errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : null,
                durationMs: durationMs || null,
                payload: safePayload,
            },
        });
    } catch (err) {
        // Never break the call site
        logger.warn('Failed to record webhook delivery', { err: err.message, eventType, clinicId });
    }
}

/**
 * Robust request helper using standard Node modules
 */
function performRequest(url, body, headers) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const protocol = parsedUrl.protocol === 'https:' ? require('https') : require('http');
        
        const req = protocol.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                ...headers,
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => resBody += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve(res.statusCode);
            } else {
                logger.error('Webhook Server returned error', { statusCode: res.statusCode, body: resBody });
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });
        });

        req.on('error', reject);
        req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(body);
        req.end();
    });
}



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
        { from, body, provider, clinicId: clinic.id, raw: raw || null },
        clinic.webhookUrl,
        clinic.webhookSecret,
        { maxRetries: 3, baseDelay: 500, clinic }
    );
}

module.exports = { triggerWebhook, forwardInboundMessage, buildClinicContext, performRequest };
