const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');
const logger = require('../utils/logger');

// Prefer pooled connection URL for production scale
const connectionString = process.env.DATABASE_CONNECTION_POOL_URL || process.env.DATABASE_URL;

// Configure the underlying pg pool for high reliability
const pool = new pg.Pool({
    connectionString,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Retry logic for initial connection — prevents startup with broken DB
async function connectWithRetry(maxRetries = 5, baseDelay = 2000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await pool.query('SELECT 1');
            logger.info('Database connection established', { attempt });
            return;
        } catch (err) {
            logger.warn('Database connection failed, retrying', {
                attempt,
                maxRetries,
                delay: baseDelay * attempt,
                error: err.message,
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

module.exports = prisma;
module.exports.connectWithRetry = connectWithRetry;
