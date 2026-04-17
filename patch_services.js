const fs = require('fs');

// ── system.js — remove Twilio config checks ──────────────────────────────────
let sys = fs.readFileSync('backend/routes/system.js', 'utf8');

// Replace Twilio SMS warning with generic SMS warning
sys = sys.replace(
    /if \(!process\.env\.TWILIO_ACCOUNT_SID \|\| !process\.env\.TWILIO_AUTH_TOKEN \|\| !process\.env\.TWILIO_PHONE_NUMBER\) \{[\s\S]*?warnings\.push\(\{[^}]+\}\);\s*\}/,
    `if (!process.env.SMS_WEBHOOK_URL && !process.env.WEBHOOK_URL) {
        warnings.push({ key: 'sms', message: 'SMS webhook URL is not configured.' });
    }`
);

// Replace Twilio status checks in stats/config
sys = sys.replace(/SMS: !!\(process\.env\.TWILIO_ACCOUNT_SID[^)]+\)/g, 'SMS: !!(process.env.SMS_WEBHOOK_URL || process.env.WEBHOOK_URL)');
sys = sys.replace(/twilioConfigured: !!\(process\.env\.TWILIO_ACCOUNT_SID[^)]+\)/g, 'smsConfigured: !!(process.env.SMS_WEBHOOK_URL || process.env.WEBHOOK_URL)');
sys = sys.replace(/voiceConfigured: !!\(process\.env\.TWILIO_ACCOUNT_SID[^)]+\)/g, 'voiceConfigured: false');

fs.writeFileSync('backend/routes/system.js', sys, 'utf8');
console.log('system.js patched');

// ── recoveryTrackingService.js — rename Twilio-specific functions ─────────────
let rts = fs.readFileSync('backend/services/recoveryTrackingService.js', 'utf8');
rts = rts.replace(/normalizeTwilioMessageStatus/g, 'normalizeMessageStatus');
rts = rts.replace(/handleTwilioStatusCallback/g, 'handleProviderStatusCallback');
fs.writeFileSync('backend/services/recoveryTrackingService.js', rts, 'utf8');
console.log('recoveryTrackingService.js patched');

// ── messagingService.js — rename error code ───────────────────────────────────
let ms = fs.readFileSync('backend/services/messagingService.js', 'utf8');
ms = ms.replace(/TWILIO_SEND_FAILED/g, 'SMS_SEND_FAILED');
fs.writeFileSync('backend/services/messagingService.js', ms, 'utf8');
console.log('messagingService.js patched');

// ── webhooks.js — clean Twilio comments ───────────────────────────────────────
let wh = fs.readFileSync('backend/routes/webhooks.js', 'utf8');
wh = wh.replace(/\/\/ Used by n8n inbound SMS workflow[^\n]* resolves clinicId from Twilio number[^\n]*/g,
    '// Used by n8n inbound SMS workflow — resolves clinicId from phone number, missedCallId from active case');
wh = wh.replace(/\/\/ Resolve clinicId from Twilio "To" number[^\n]*/g,
    '// Resolve clinicId from "To" number if not explicitly provided');
fs.writeFileSync('backend/routes/webhooks.js', wh, 'utf8');
console.log('webhooks.js patched');

// ── schema.prisma — rename callSid comment ────────────────────────────────────
let schema = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');
schema = schema.replace(/\/\/ Twilio\/external call ID for dedup/g, '// External call ID for dedup');
fs.writeFileSync('backend/prisma/schema.prisma', schema, 'utf8');
console.log('schema.prisma patched');

// ── .env.example — check what Twilio vars are there ──────────────────────────
let env = fs.readFileSync('.env.example', 'utf8');
const twilioLines = env.split('\n').filter(l => l.toLowerCase().includes('twilio') || l.toLowerCase().includes('vapi'));
console.log('Twilio/Vapi lines in .env.example:', twilioLines);
