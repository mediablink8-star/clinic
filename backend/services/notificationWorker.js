const cron = require('node-cron');
const { safeAddReminder } = require('./queueService');
const { getDueNotifications, markNotificationEnqueued } = require('./notificationService');
const { processScheduledMissedCalls } = require('./missedCallService');

/**
 * Cron: find SCHEDULED notifications and enqueue them into BullMQ.
 * No business logic here — just scan + enqueue + mark.
 */
function startNotificationWorker() {
    cron.schedule('* * * * *', async () => {
        try {
            const pending = await getDueNotifications();

            for (const item of pending) {
                const job = await safeAddReminder({ notificationId: item.id });
                if (!job) continue;
                await markNotificationEnqueued(item.id);
            }

            if (pending.length > 0) {
                console.log(`[NotificationWorker] Enqueued ${pending.length} notification jobs`);
            }
        } catch (error) {
            console.error('[NotificationWorker] Enqueuer error:', error.message);
        }
    });
}

/**
 * Cron: placeholder for post-appointment follow-ups.
 */
function startFollowUpWorker() {
    cron.schedule('0 * * * *', async () => {
        // Follow-up logic delegated to service when implemented
    });
}

/**
 * Cron: fire delayed missed-call SMS when working hours begin.
 * No business logic here — delegates entirely to missedCallService.
 */
function startScheduledSmsWorker() {
    cron.schedule('* * * * *', async () => {
        try {
            const count = await processScheduledMissedCalls();
            if (count > 0) {
                console.log(`[ScheduledSmsWorker] Processed ${count} delayed SMS(es)`);
            }
        } catch (err) {
            console.error('[ScheduledSmsWorker] Error:', err.message);
        }
    });
}

module.exports = { startNotificationWorker, startFollowUpWorker, startScheduledSmsWorker };
