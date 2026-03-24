require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const rows = await prisma.$queryRaw`SELECT email, passwordHash, role, clinicId FROM User`;
    for (const u of rows) {
        console.log('User:', u.email, 'role:', u.role, 'clinicId:', u.clinicId);
        const match123 = await bcrypt.compare('admin123', u.passwordHash);
        const matchClinic = await bcrypt.compare('clinic123', u.passwordHash);
        const matchPass = await bcrypt.compare('password', u.passwordHash);
        console.log('  admin123:', match123, '  clinic123:', matchClinic, '  password:', matchPass);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
