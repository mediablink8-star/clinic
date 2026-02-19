const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('./services/authService');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function patch() {
    console.log('Patching existing clinics...');
    try {
        const clinics = await prisma.clinic.findMany();
        for (const clinic of clinics) {
            const tempPassword = 'password123'; // Default password for migration
            const hashedPassword = await hashPassword(tempPassword);
            const webhookSecret = crypto.randomBytes(32).toString('hex');

            await prisma.clinic.update({
                where: { id: clinic.id },
                data: {
                    password: hashedPassword,
                    webhookSecret: webhookSecret
                }
            });
            console.log(`✅ Patched clinic: ${clinic.name} (Password set to: password123)`);
        }
    } catch (e) {
        console.error('❌ Patch failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

patch();
