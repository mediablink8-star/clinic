require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const clinics = await prisma.clinic.findMany({ select: { id: true, name: true } });
    console.log('Clinics:', JSON.stringify(clinics, null, 2));

    const calls = await prisma.missedCall.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, clinicId: true, fromNumber: true, status: true, smsStatus: true, createdAt: true }
    });
    console.log('Recent missed calls:', JSON.stringify(calls, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
