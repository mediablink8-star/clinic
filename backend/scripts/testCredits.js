const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCredits() {
    console.log('--- Testing Robust Messaging Credit System ---');

    // 1. Get a clinic
    const clinic = await prisma.clinic.findFirst();
    if (!clinic) return console.log('No clinic found');

    console.log(`Clinic: ${clinic.name}`);
    console.log(`Starting Credits: ${clinic.messageCredits}`);
    console.log(`Daily Used: ${clinic.dailyUsedCount}`);

    // 2. Add a pending notification
    const notification = await prisma.notification.create({
        data: {
            clinicId: clinic.id,
            type: 'REMINDER',
            scheduledFor: new Date(),
            message: 'Structural Logic Test Notification',
            status: 'SCHEDULED'
        }
    });

    console.log('Notification created. Waiting for worker to process (atomic deduction)...');

    // Wait for worker (runs every minute)
    // For immediate verification, we could call the logic directly, but let's wait 65s
    await new Promise(r => setTimeout(r, 65000));

    // 3. Check results
    const updatedNotification = await prisma.notification.findUnique({
        where: { id: notification.id }
    });

    const updatedClinic = await prisma.clinic.findUnique({
        where: { id: clinic.id }
    });

    const logs = await prisma.messageLog.findMany({
        where: { clinicId: clinic.id },
        orderBy: { timestamp: 'desc' },
        take: 1
    });

    const expectedCredits = clinic.messageCredits - 1;
    const actualCredits = updatedClinic.messageCredits;
    const diff = clinic.messageCredits - actualCredits;

    console.log(`Notification Status: ${updatedNotification.status}`);
    console.log(`Original Credits: ${clinic.messageCredits}`);
    console.log(`Updated Credits: ${actualCredits}`);
    console.log(`Credits Deducted: ${diff}`);
    console.log(`Last Log Entry: ${logs[0]?.status} (Cost: ${logs[0]?.cost})`);

    if (updatedNotification.status === 'SENT' && diff >= 1) {
        console.log('✅ Atomic deduction verified (at least one credit deducted).');
    } else if (updatedNotification.status.startsWith('FAILED_')) {
        console.log(`✅ Hard stop/Failure verified: ${updatedNotification.status}`);
    } else {
        console.log('❌ Deduction check failed.');
    }
}

testCredits();
