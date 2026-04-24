require('dotenv').config(); // MUST be first — env vars must be set before any service is loaded
const { startNotificationWorker, startFollowUpWorker, startScheduledSmsWorker } = require('./services/notificationWorker');
const { reminderWorker } = require('./services/queueService'); // Import to start BullMQ worker

console.log('🚀 SaaS-Grade Background Worker process starting...');

// BullMQ worker always runs — it processes jobs enqueued by external workflows or internal cron
console.log('✅ BullMQ reminder worker running.');

// Internal cron automation — disabled by default.
// Set USE_INTERNAL_AUTOMATION=true to use built-in scheduling instead of an external workflow tool.
if (process.env.USE_INTERNAL_AUTOMATION === 'true') {
    startNotificationWorker();
    startFollowUpWorker();
    startScheduledSmsWorker();
    console.log('✅ Internal cron automation enabled (USE_INTERNAL_AUTOMATION=true).');
} else {
    console.log('ℹ️  Internal cron automation disabled. Use /api/automation/* endpoints instead.');
}

// Keep process alive
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing worker');
    process.exit(0);
});

// Keep Render free tier alive — ping health endpoint every 10 minutes
if (process.env.NODE_ENV === 'production' && process.env.BACKEND_API_URL) {
    const https = require('https');
    const http = require('http');
    setInterval(() => {
        const url = process.env.BACKEND_API_URL.replace(/\/api$/, '') + '/api/health';
        try {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, (res) => { res.resume(); });
            req.on('error', () => {});
            req.setTimeout(5000, () => req.destroy());
        } catch {}
    }, 10 * 60 * 1000); // every 10 minutes
    console.log('✅ Keep-alive ping enabled.');
}
