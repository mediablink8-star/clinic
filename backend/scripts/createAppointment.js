const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function create() {
    try {
        console.log('Manually creating Appointment table...');

        // First, ensure enums exist (Prisma might have missed them or they might be problematic)
        try {
            await prisma.$executeRawUnsafe(`CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED')`);
            console.log('✅ Created AppointmentStatus enum');
        } catch (e) {
            console.log('ℹ️ AppointmentStatus enum might already exist or failed:', e.message);
        }

        try {
            await prisma.$executeRawUnsafe(`CREATE TYPE "Priority" AS ENUM ('URGENT', 'NORMAL')`);
            console.log('✅ Created Priority enum');
        } catch (e) {
            console.log('ℹ️ Priority enum might already exist or failed:', e.message);
        }

        await prisma.$executeRawUnsafe(`
            CREATE TABLE "public"."Appointment" (
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

                CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
                CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
                CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
            )
        `);
        console.log('✅ Appointment table created successfully!');
    } catch (e) {
        console.error('❌ Manual creation failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
create();
