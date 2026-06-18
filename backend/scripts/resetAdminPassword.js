/**
 * One-time script to reset a platform admin (or any user) password.
 * Usage:
 *   node scripts/resetAdminPassword.js
 *
 * Set TARGET_EMAIL and NEW_PASSWORD below, or pass as env vars:
 *   TARGET_EMAIL=admin@example.com NEW_PASSWORD=MyNewPass123 node scripts/resetAdminPassword.js
 */

const TARGET_EMAIL = process.env.TARGET_EMAIL || null; // set this or pass via env
const NEW_PASSWORD = process.env.NEW_PASSWORD || 'Admin123!';

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    // Find target user
    let user;
    if (TARGET_EMAIL) {
        user = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
    } else {
        // Fall back to first platform admin
        user = await prisma.user.findFirst({ where: { isPlatformAdmin: true } });
    }

    if (!user) {
        console.error('❌  No user found. Set TARGET_EMAIL env var or ensure a platform admin exists.');
        process.exit(1);
    }

    const hash = await bcrypt.hash(NEW_PASSWORD, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            passwordHash: hash,
            failedAttempts: 0,
            lockedUntil: null,
        },
    });

    console.log(`✅  Password reset for: ${user.email}`);
    console.log(`    New password: ${NEW_PASSWORD}`);
    console.log(`    isPlatformAdmin: ${user.isPlatformAdmin}`);
    console.log('\n⚠️  Delete or disable this script after use.');
}

main()
    .catch(e => { console.error('❌  Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
