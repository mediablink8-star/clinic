require('dotenv').config();
const { startNotificationWorker } = require('./services/notificationWorker');

console.info('🚀 SaaS-Grade Background Worker process starting...');

const worker = startNotificationWorker();
console.info('✅ BullMQ workers started (reminders + scheduler).');

// Export stop function for graceful shutdown
function stop() {
    console.info('[Worker] Stopping BullMQ workers...');
    if (worker && worker.close) {
        worker.close().catch(err => console.error('[Worker] Close failed:', err.message));
    }
}

// Keep process alive
process.on('SIGTERM', () => {
    console.info('[Worker] SIGTERM signal received: shutting down gracefully');
    stop();
    process.exit(0);
});

// Keep Render free tier alive — ping health endpoint every 10 minutes
if (process.env.NODE_ENV === 'production' && process.env.BACKEND_API_URL) {
    const https = require('https');
    const http = require('http');
    const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000;
    let keepaliveTimer = null;

    function ping() {
        const url = process.env.BACKEND_API_URL.replace(/\/api$/, '') + '/api/health';
        try {
            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, (res) => {
                res.resume();
                if (res.statusCode >= 500) {
                    console.warn(`[Keep-alive] Backend returned ${res.statusCode}, retrying in 30s`);
                    if (keepaliveTimer) clearTimeout(keepaliveTimer);
                    keepaliveTimer = setTimeout(ping, 30000);
                }
            });
            req.on('error', (err) => {
                console.warn('[Keep-alive] Request error:', err.message);
                if (keepaliveTimer) clearTimeout(keepaliveTimer);
                keepaliveTimer = setTimeout(ping, 60000); // backoff on error
            });
            req.setTimeout(5000, () => req.destroy());
        } catch (err) {
            console.warn('[Keep-alive] Failed to ping:', err.message);
        }
    }

    keepaliveTimer = setInterval(ping, KEEP_ALIVE_INTERVAL);
    console.info('✅ Keep-alive ping enabled (every 10 min with backoff).');
}

module.exports = { stop };
