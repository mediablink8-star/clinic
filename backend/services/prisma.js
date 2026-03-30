const { PrismaClient } = require('@prisma/client');

// Singleton — one connection pool shared across the entire server process.
// Prevents connection exhaustion under load.
const prisma = new PrismaClient();

module.exports = prisma;
