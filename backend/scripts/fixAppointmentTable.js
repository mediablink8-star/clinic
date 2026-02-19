const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔨 Fixing Appointment Table and Constraints...');

    const commands = [
        // 1. Create Appointment Table
        `CREATE TABLE "Appointment" (
            "id" TEXT NOT NULL,
            "clinicId" TEXT NOT NULL,
            "patientId" TEXT NOT NULL,
            "startTime" TIMESTAMP(3) NOT NULL,
            "endTime" TIMESTAMP(3) NOT NULL,
            "reason" TEXT,
            "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
            "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
            "notes" TEXT,
            "aiClassification" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
        )`,

        // 2. Add Constraints
        `ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE "Notification" ADD CONSTRAINT "Notification_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE`
    ];

    for (const cmd of commands) {
        try {
            await prisma.$executeRawUnsafe(cmd);
            console.log(`  ✅ Success: ${cmd.substring(0, 50)}...`);
        } catch (e) {
            console.warn(`  ⚠️ Warning: ${e.message}`);
        }
    }

    console.log('🎊 Fix Finished!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
