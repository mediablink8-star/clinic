const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

// Prefer pooled connection URL for production scale
const connectionString = process.env.DATABASE_CONNECTION_POOL_URL || process.env.DATABASE_URL;

// Configure the underlying pg pool for high reliability
const pool = new pg.Pool({
    connectionString,
    max: 20, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ 
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = prisma;
