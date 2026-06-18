require('dotenv').config();
const { startNotificationWorker } = require('./services/notificationWorker');
const { startRecoveryWorker } = require('./services/recoveryWorker');
const { connection: recoveryConnection } = require('./services/recoveryQueue');
const logger = require('./utils/logger');

logger.info('Background worker process starting...');

const worker = startNotificationWorker();
logger.info('Worker Background worker started', { mode: worker?.mode || 'unknown' });

// Start recovery worker if Redis is available
const recoveryWorker = startRecoveryWorker(recoveryConnection);
if (recoveryWorker) {
    logger.info('Recovery worker started');
}

async function stop() {
    logger.info('Worker Stopping background worker...');
    if (worker && worker.close) {
        await worker.close().catch(err => logger.error('Worker Close failed', { error: err.message }));
    }
    if (recoveryWorker && recoveryWorker.close) {
        await recoveryWorker.close().catch(err => logger.error('RecoveryWorker Close failed', { error: err.message }));
    }
    return Promise.resolve();
}

if (require.main === module) {
    process.on('SIGTERM', () => {
        logger.info('Worker SIGTERM signal received: shutting down gracefully');
        stop().finally(() => process.exit(0));
    });

    process.on('SIGINT', () => {
        logger.info('Worker SIGINT signal received: shutting down gracefully');
        stop().finally(() => process.exit(0));
    });
}

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
                    logger.warn('Keep-alive Backend returned error', { statusCode: res.statusCode });
                    if (keepaliveTimer) clearTimeout(keepaliveTimer);
                    keepaliveTimer = setTimeout(ping, 30000);
                }
            });
            req.on('error', (err) => {
                logger.warn('Keep-alive Request error', { error: err.message });
                if (keepaliveTimer) clearTimeout(keepaliveTimer);
                keepaliveTimer = setTimeout(ping, 60000);
            });
            req.setTimeout(5000, () => req.destroy());
        } catch (err) {
            logger.warn('Keep-alive Failed to ping', { error: err.message });
        }
    }

    keepaliveTimer = setInterval(ping, KEEP_ALIVE_INTERVAL);
    logger.info('Keep-alive ping enabled.');
}

module.exports = { stop };
