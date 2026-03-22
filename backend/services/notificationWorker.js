const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { safeAddReminder } = require('./queueService');

/**
 * Enqueuer to find scheduled notifications and add them to BullMQ
 */
function startNotificationWorker() {
    cron.schedule('* * * * *', async () => {
        console.log('Scanning for due notifications to enqueue...');
        const now = new Date();

        try {
            const pending = await prisma.notification.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduledFor: { lte: now }
                },
                select: { id: true }
            });

            for (const item of pending) {
                const job = await safeAddReminder({ notificationId: item.id });

                if (!job) continue; // Skip state update if enqueuing failed

                // Optimistically mark as ENQUEUED to prevent double enqueuing in next scan
                await prisma.notification.update({
                    where: { id: item.id },
                    data: { status: 'ENQUEUED' }
                });
            }

            if (pending.length > 0) {
                console.log(`✅ Enqueued ${pending.length} notification jobs`);
            }
        } catch (error) {
            console.error('Enqueuer Error:', error);
        }
    });
}

/**
 * Worker to handle post-appointment follow-ups
 */
function startFollowUpWorker() {
    cron.schedule('0 * * * *', async () => {
        console.log('Follow-up worker running...');
    });
}

module.exports = { startNotificationWorker, startFollowUpWorker };
