const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🧹 Cleaning up Premium SaaS Mock Data...');

    const clinicId = 'premium-clinic';

    // Delete in correct order to avoid foreign key constraints
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        include: {
            appointments: true,
            patients: true,
            missedCalls: true,
            users: true,
            notifications: true,
            messageLogs: true,
            auditLogs: true
        }
    });

    if (!clinic) {
        console.log('ℹ️ No mock data found for ID: premium-clinic. Already clean!');
        return;
    }

    try {
        await prisma.feedback.deleteMany({ where: { appointment: { clinicId } } });
        await prisma.notification.deleteMany({ where: { clinicId } });
        await prisma.auditLog.deleteMany({ where: { clinicId } });
        await prisma.messageLog.deleteMany({ where: { clinicId } });
        await prisma.missedCall.deleteMany({ where: { clinicId } });
        await prisma.appointment.deleteMany({ where: { clinicId } });
        await prisma.refreshToken.deleteMany({ where: { user: { clinicId } } });
        await prisma.user.deleteMany({ where: { clinicId } });
        await prisma.patient.deleteMany({ where: { clinicId } });
        await prisma.clinic.delete({ where: { id: clinicId } });

        console.log('✅ Successfully removed all mock data for "Advanced Dental Care Athens".');
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
