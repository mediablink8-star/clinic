/**
 * SMS fallback service for Voice AI calls.
 * Triggers Vonage SMS via n8n workflow 2 (direct SMS webhook).
 */
const https = require('https');
const http = require('http');
const { decrypt } = require('./encryptionService');

function triggerN8nSms(clinic, phone, message, missedCallId) {
    const webhookUrl = clinic.webhookDirectSms || clinic.webhookReminders || clinic.webhookUrl;
    if (!webhookUrl) {
        console.warn(`[SMS] No webhook URL for clinic ${clinic.id}`);
        return Promise.resolve({ success: false, reason: 'no_webhook' });
    }

    const vonageApiKey = clinic.vonageApiKey ? decrypt(clinic.vonageApiKey) : null;
    const vonageApiSecret = clinic.vonageApiSecret ? decrypt(clinic.vonageApiSecret) : null;

    const body = JSON.stringify({
        phone,
        message,
        notificationId: missedCallId,
        clinicId: clinic.id,
        ...(vonageApiKey && { vonageApiKey }),
        ...(vonageApiSecret && { vonageApiSecret }),
        ...(clinic.vonageFromName && { vonageFromName: clinic.vonageFromName }),
    });

    const secret = process.env.WEBHOOK_SECRET || '';

    return new Promise((resolve) => {
        try {
            const parsed = new URL(webhookUrl);
            const lib = parsed.protocol === 'https:' ? https : http;
            const req = lib.request({
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'x-webhook-key': secret,
                },
            }, (res) => {
                res.resume();
                console.log(`[SMS] Sent to ${phone} — status ${res.statusCode}`);
                resolve({ success: res.statusCode < 400 });
            });
            req.on('error', (err) => {
                console.warn(`[SMS] Failed: ${err.message}`);
                resolve({ success: false, reason: err.message });
            });
            req.setTimeout(10000, () => { req.destroy(); resolve({ success: false, reason: 'timeout' }); });
            req.write(body);
            req.end();
        } catch (err) {
            console.warn(`[SMS] triggerN8nSms error: ${err.message}`);
            resolve({ success: false, reason: err.message });
        }
    });
}

module.exports = { triggerN8nSms };
