require('dotenv').config(); // MUST be first — env vars must be set before any service is loaded
const { startNotificationWorker } = require('./services/notificationWorker');

console.info('🚀 SaaS-Grade Background Worker process starting...');

// Start the BullMQ workers by default
startNotificationWorker();
console.info('✅ BullMQ workers started (reminders + scheduler).');

// Keep process alive
process.on('SIGTERM', () => {
    console.info('SIGTERM signal received: closing worker');
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
            req.on('error', (err) => console.warn('[Keep-alive] Request error:', err.message));
            req.setTimeout(5000, () => req.destroy());
        } catch (err) {
            console.warn('[Keep-alive] Failed to ping:', err.message);
        }
    }, 10 * 60 * 1000); // every 10 minutes
    console.info('✅ Keep-alive ping enabled.');
}
