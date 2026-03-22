const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Adding/Updating Clinic columns...');
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "messageCredits" INTEGER DEFAULT 100;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "monthlyCreditLimit" INTEGER DEFAULT 100;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "creditResetDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "dailyMessageCap" INTEGER DEFAULT 300;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "dailyUsedCount" INTEGER DEFAULT 0;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "lastResetDay" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`;
        // Cleanup old column if it exists (renamed/replaced by daily/monthly logic)
        // await prisma.$executeRaw`ALTER TABLE "Clinic" DROP COLUMN IF EXISTS "totalUsedCredits";`;

        console.log('Creating MessageLog table if not exists...');
        await prisma.$executeRaw`
            CREATE TABLE IF NOT EXISTS "MessageLog" (
                "id" TEXT NOT NULL,
                "clinicId" TEXT NOT NULL,
                "type" TEXT NOT NULL,
                "cost" INTEGER NOT NULL DEFAULT 1,
                "status" TEXT NOT NULL,
                "error" TEXT,
                "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
            );
        `;
        await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS "MessageLog_clinicId_idx" ON "MessageLog"("clinicId");`;

        console.log('Initializing values...');
        await prisma.$executeRaw`UPDATE "Clinic" SET "monthlyCreditLimit" = 100 WHERE "monthlyCreditLimit" IS NULL;`;
        await prisma.$executeRaw`UPDATE "Clinic" SET "dailyMessageCap" = 300 WHERE "dailyMessageCap" IS NULL;`;

        console.log('✅ Strategic Messaging Columns and Table added successfully!');
    } catch (e) {
        console.error('❌ Error adding columns:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
