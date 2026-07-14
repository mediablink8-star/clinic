/**
 * Recovery Rate Updater - Runs periodically to update recovery rate metrics
 * Can be called from a cron job or background worker
 */

const prisma = require('../services/prisma');
const metrics = require('../utils/metrics');

async function updateRecoveryRates() {
    try {
        const clinics = await prisma.clinic.findMany({
            where: { isActive: true },
            select: { id: true },
        });

        for (const clinic of clinics) {
            // Get recovery stats for this clinic (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const [totalMissed, recovered] = await Promise.all([
                prisma.missedCall.count({
                    where: {
                        clinicId: clinic.id,
                        createdAt: { gte: thirtyDaysAgo },
                    },
                }),
                prisma.missedCall.count({
                    where: {
                        clinicId: clinic.id,
                        status: 'RECOVERED',
                        recoveredAt: { gte: thirtyDaysAgo },
                    },
                }),
            ]);

            const rate = totalMissed > 0 ? Math.round((recovered / totalMissed) * 100) : 0;
            metrics.updateRecoveryRate(clinic.id, rate);
        }

        console.log(`[${new Date().toISOString()}] Updated recovery rates for ${clinics.length} clinics`);
    } catch (err) {
        console.error('Failed to update recovery rates:', err);
    }
}

// Run if called directly
if (require.main === module) {
    updateRecoveryRates()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = { updateRecoveryRates };