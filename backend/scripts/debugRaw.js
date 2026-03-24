require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Use raw SQL to bypass enum validation
    const users = await prisma.$queryRaw`SELECT email, role, clinicId FROM User LIMIT 5`;
    console.log('Users:', JSON.stringify(users, null, 2));

    const log = await prisma.$queryRaw`SELECT id, clinicId, fromNumber, status, smsStatus FROM MissedCall ORDER BY createdAt DESC LIMIT 5`;
    console.log('MissedCalls:', JSON.stringify(log, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
