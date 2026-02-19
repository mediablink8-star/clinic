const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log('Attempting to query appointments...');
        const count = await prisma.appointment.count();
        console.log('Appointment count:', count);
    } catch (e) {
        console.error('❌ Error querying appointment model:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
