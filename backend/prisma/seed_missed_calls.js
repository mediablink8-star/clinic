const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedMissedCalls() {
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) {
        console.error("No clinic found. Please run seed_saas.js first.");
        return;
    }

    console.log(`Seeding missed calls for clinic: ${clinic.name}`);

    const missedCalls = [
        {
            clinicId: clinic.id,
            fromNumber: '+306912345678',
            status: 'RECOVERED',
            estimatedRevenue: 150.0,
            recoveredAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
            createdAt: new Date(Date.now() - 3600000 * 5)
        },
        {
            clinicId: clinic.id,
            fromNumber: '+306922334455',
            status: 'RECOVERING',
            estimatedRevenue: 150.0,
            createdAt: new Date(Date.now() - 3600000 * 1)
        },
        {
            clinicId: clinic.id,
            fromNumber: '+306933445566',
            status: 'DETECTED',
            estimatedRevenue: 250.0,
            createdAt: new Date(Date.now() - 4000000)
        },
        {
            clinicId: clinic.id,
            fromNumber: '+306944556677',
            status: 'RECOVERED',
            estimatedRevenue: 300.0,
            recoveredAt: new Date(Date.now() - 3600000 * 24), // Yesterday
            createdAt: new Date(Date.now() - 3600000 * 25)
        }
    ];

    for (const mc of missedCalls) {
        await prisma.missedCall.create({ data: mc });
    }

    console.log("Mock missed calls seeded successfully.");
}

seedMissedCalls()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
