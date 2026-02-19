const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Adding columns to Clinic table...');
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "password" TEXT;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "googleId" TEXT;`;
        await prisma.$executeRaw`ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`;

        console.log('Initializing placeholder values...');
        await prisma.$executeRaw`UPDATE "Clinic" SET "password" = 'REPLACE_ME' WHERE "password" IS NULL;`;
        await prisma.$executeRaw`UPDATE "Clinic" SET "webhookSecret" = 'REPLACE_ME' WHERE "webhookSecret" IS NULL;`;
        await prisma.$executeRaw`UPDATE "Clinic" SET "avatarUrl" = 'https://images.unsplash.com/photo-1516542077369-bc831dfb1b17?q=80&w=1000' WHERE "avatarUrl" IS NULL;`;

        console.log('✅ Columns added and initialized successfully!');
    } catch (e) {
        console.error('❌ Error adding columns:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
