const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { safeAddReminder } = require('./queueService');
const { triggerWebhook } = require('./webhookService');

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

/**
 * Scheduled SMS worker — fires queued missed-call SMS when working hours begin.
 * Runs every minute, picks up any MissedCall with smsStatus='scheduled'
 * where scheduledSmsAt <= now.
 */
function startScheduledSmsWorker() {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        try {
            const due = await prisma.missedCall.findMany({
                where: {
                    smsStatus: 'scheduled',
                    scheduledSmsAt: { lte: now }
                },
                include: { clinic: true }
            });

            for (const mc of due) {
                const clinic = mc.clinic;
                if (!clinic) continue;

                console.log(`[ScheduledSMS] Firing delayed SMS for ${mc.fromNumber} (missedCallId: ${mc.id})`);

                await prisma.missedCall.update({
                    where: { id: mc.id },
                    data: { smsStatus: 'processing' }
                });

                if (clinic.webhookUrl) {
                    try {
                        const result = await triggerWebhook(
                            'missed_call.detected',
                            { phone: mc.fromNumber, missedCallId: mc.id, clinicId: mc.clinicId },
                            clinic.webhookUrl,
                            clinic.webhookSecret,
                            { maxRetries: 3, baseDelay: 500 }
                        );

                        await prisma.missedCall.update({
                            where: { id: mc.id },
                            data: result.success
                                ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
                                : { smsStatus: 'failed', smsError: result.error || 'Webhook failed' }
                        });
                    } catch (err) {
                        await prisma.missedCall.update({
                            where: { id: mc.id },
                            data: { smsStatus: 'failed', smsError: err.message }
                        });
                    }
                } else {
                    // No webhook configured — mark as pending (will send when configured)
                    await prisma.missedCall.update({
                        where: { id: mc.id },
                        data: { smsStatus: 'pending' }
                    });
                }
            }

            if (due.length > 0) {
                console.log(`[ScheduledSMS] Processed ${due.length} delayed SMS(es)`);
            }
        } catch (err) {
            console.error('[ScheduledSMS] Worker error:', err.message);
        }
    });
}

module.exports = { startNotificationWorker, startFollowUpWorker, startScheduledSmsWorker };
