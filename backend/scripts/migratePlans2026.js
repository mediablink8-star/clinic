/**
 * One-time migration: update existing clinics from old plan keys to new 2026 pricing.
 *
 * Run: node backend/scripts/migratePlans2026.js
 *
 * Old → New mapping:
 *   solo  → starter: $350/mo, 200 SMS, 100 AI
 *   team  → growth:  $600/mo, 600 SMS, 250 AI
 *   multi → scale:   $1000/mo, 1500 SMS, 600 AI
 *   trial, enterprise → unchanged
 */
const prisma = require('../services/prisma');

const MIGRATIONS = {
    solo:  { plan: 'starter', smsMonthlyLimit: 200, aiMonthlyLimit: 100,  dailyMessageCap: 100 },
    team:  { plan: 'growth',  smsMonthlyLimit: 600, aiMonthlyLimit: 250,  dailyMessageCap: 200 },
    multi: { plan: 'scale',   smsMonthlyLimit: 1500, aiMonthlyLimit: 600, dailyMessageCap: 500 },
};

async function main() {
    console.log('Migrating clinic plans to 2026 pricing...\n');

    for (const [oldPlan, data] of Object.entries(MIGRATIONS)) {
        const result = await prisma.clinic.updateMany({
            where: { plan: oldPlan },
            data,
        });
        console.log(`  ${oldPlan} → ${data.plan}: ${result.count} clinics updated`);
    }

    const remaining = await prisma.clinic.findMany({
        select: { id: true, name: true, plan: true },
        where: { plan: { notIn: ['trial', 'starter', 'growth', 'scale', 'enterprise'] } },
    });
    if (remaining.length > 0) {
        console.log(`\n⚠️  ${remaining.length} clinic(s) have unrecognized plans:`);
        remaining.forEach(c => console.log(`    ${c.id} (${c.name}): plan = "${c.plan}"`));
    } else {
        console.log('\n✅ All clinics have valid plans.');
    }
}

main()
    .catch(e => { console.error('Migration failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
