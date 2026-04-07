require('dotenv').config();

const prisma = require('../services/prisma');
const { backfillRecoveryCases } = require('../services/recoveryTrackingService');

async function main() {
    const days = Number(process.env.RECOVERY_BACKFILL_DAYS || 30);
    const result = await backfillRecoveryCases({ days });
    console.log(`[Backfill] Recovery cases ensured for ${result.processed} missed calls.`);
}

main()
    .catch((err) => {
        console.error('[Backfill] Failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
