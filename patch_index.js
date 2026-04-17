const fs = require('fs');
let src = fs.readFileSync('backend/index.js', 'utf8');

// Remove voice router
src = src.replace(/const voiceRouter = require\('\.\/routes\/voice'\);\s*app\.use\('\/api\/voice'[^;]+;\s*/g, '');

// Remove providerWebhooks router
src = src.replace(/\/\/ Provider-facing webhook callbacks[^\n]*\n\s*const providerWebhooksRouter = require\('\.\/routes\/providerWebhooks'\);\s*app\.use\('\/api\/webhook\/provider'[^;]+;\s*/g, '');

// Remove twilioWebhooks router
src = src.replace(/const twilioWebhooksRouter = require\('\.\/routes\/twilioWebhooks'\);\s*app\.use\('\/webhooks\/twilio'[^;]+;\s*/g, '');

// Fix error code name
src = src.replace(/TWILIO_SEND_FAILED/g, 'SMS_SEND_FAILED');

fs.writeFileSync('backend/index.js', src, 'utf8');
console.log('index.js patched');
console.log('Still has twilio routes:', src.toLowerCase().includes('twiliowebhooks') || src.toLowerCase().includes('providerwebhooks') || src.includes("'./routes/voice'"));
