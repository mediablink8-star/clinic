const Sentry = require('@sentry/node');

/**
 * Structured logger that formats as JSON in production for ELK/Sentry ingestion
 * but stays human-readable in development.
 */
const logger = {
    info: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'production') {
            console.log(JSON.stringify({ level: 'info', message, ...meta, timestamp: new Date().toISOString() }));
        } else {
            console.log(`[INFO] ${message}`, Object.keys(meta).length ? meta : '');
        }
    },
    warn: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'production') {
            console.warn(JSON.stringify({ level: 'warn', message, ...meta, timestamp: new Date().toISOString() }));
        } else {
            console.warn(`[WARN] ${message}`, Object.keys(meta).length ? meta : '');
        }
        if (meta.err || meta.error) {
            Sentry.captureException(meta.err || meta.error, { level: 'warning', extra: meta });
        }
    },
    error: (message, meta = {}) => {
        if (process.env.NODE_ENV === 'production') {
            console.error(JSON.stringify({ level: 'error', message, ...meta, timestamp: new Date().toISOString() }));
        } else {
            console.error(`[ERROR] ${message}`, Object.keys(meta).length ? meta : '');
        }
        
        let errorToCapture = meta.err || meta.error;
        if (!errorToCapture && message instanceof Error) {
            errorToCapture = message;
        } else if (!errorToCapture) {
            errorToCapture = new Error(message);
        }

        Sentry.captureException(errorToCapture, { 
            level: 'error', 
            extra: { 
                ...meta, 
                originalMessage: typeof message === 'string' ? message : undefined 
            } 
        });
    }
};

module.exports = logger;
