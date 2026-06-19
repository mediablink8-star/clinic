const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const logger = require('../utils/logger');

// Prefer pooled connection URL for production scale
const connectionString = process.env.DATABASE_CONNECTION_POOL_URL || process.env.DATABASE_URL;

// Configure the underlying pg pool for high reliability
const pool = new pg.Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Retry logic for initial connection
async function connectWithRetry(maxRetries = 5, baseDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await pool.query('SELECT 1');
            logger.info('Database connection established', { attempt });
            return;
        } catch (err) {
            logger.warn('Database connection failed, retrying', {
                attempt, maxRetries, delay: baseDelay * attempt, error: err.message,
            });
            if (attempt === maxRetries) {
                logger.error('Database connection failed after all retries — exiting');
                process.exit(1);
            }
            await new Promise(r => setTimeout(r, baseDelay * attempt));
        }
    }
}

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Wrap with automatic retry for transient Supabase pool exhaustion errors
// This catches EMAXCONNSESSION / "max clients reached" errors and retries
const prismaWithRetry = prisma.$extends({
    query: {
        async $allOperations({ operation, args, query }) {
            const maxRetries = 3;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await query(args);
                } catch (err) {
                    const isPoolError =
                        err.message?.includes('EMAXCONNSESSION') ||
                        err.message?.includes('max clients reached') ||
                        err.cause?.code === 'XX000';
                    if (isPoolError && attempt < maxRetries) {
                        const delay = 1000 * (attempt + 1);
                        logger.warn('DB pool exhausted, retrying', {
                            operation,
                            attempt: attempt + 1,
                            delay,
                        });
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                    throw err;
                }
            }
        },
    },
});

module.exports = prismaWithRetry;
module.exports.connectWithRetry = connectWithRetry;
module.exports.prisma = prisma;
