const https = require('https');

/**
 * Sends an SMS via Twilio.
 * Uses TWILIO_PHONE_NUMBER as sender if set (works on trial + paid).
 * Falls back to TWILIO_ALPHA_SENDER_ID for alphanumeric sender (paid accounts only).
 */
function sendSms({ to, body }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.error('[Twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
        return Promise.resolve({ success: false, error: 'Twilio not configured' });
    }

    // Prefer phone number (works on trial), fall back to alphanumeric sender ID (paid only)
    const sender = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_ALPHA_SENDER_ID || '';
    if (!sender) {
        console.error('[Twilio] No sender configured — set TWILIO_PHONE_NUMBER or TWILIO_ALPHA_SENDER_ID');
        return Promise.resolve({ success: false, error: 'No Twilio sender configured. Set TWILIO_PHONE_NUMBER or TWILIO_ALPHA_SENDER_ID.' });
    }

    const payload = `To=${encodeURIComponent(to)}&From=${encodeURIComponent(sender)}&Body=${encodeURIComponent(body)}`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload),
                'Authorization': `Basic ${auth}`,
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        console.info(`[Twilio] SMS sent: ${parsed.sid} → ***${to.slice(-4)}`);
                        resolve({ success: true, sid: parsed.sid });
                    } catch {
                        resolve({ success: true });
                    }
                } else {
                    let errMsg = `HTTP ${res.statusCode}`;
                    try { const parsed = JSON.parse(data); errMsg = parsed.message || errMsg; } catch {}
                    console.warn(`[Twilio] Failed: ${errMsg}`);
                    resolve({ success: false, error: errMsg });
                }
            });
        });
        req.on('error', (err) => {
            console.warn(`[Twilio] Request failed: ${err.message}`);
            resolve({ success: false, error: err.message });
        });
        req.setTimeout(15000, () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
        req.write(payload);
        req.end();
    });
}

module.exports = { sendSms };
