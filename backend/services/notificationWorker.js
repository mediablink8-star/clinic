const { Queue, Worker } = require('bullmq');
const { getDueNotifications, markNotificationEnqueued } = require('./notificationService');
const { processScheduledMissedCalls } = require('./missedCallService');

/**
 * Cluster-safe background workers using BullMQ repeatable jobs.
 * Redis distributed locking ensures jobs fire exactly once across all instances.
 * 
 * Replaces node-cron which would fire on every server instance causing duplicate SMS.
 */

let schedulerQueue = null;
let schedulerWorker = null;
let reminderWorker = null;
let workersRunning = false;

function startNotificationWorker() {
    const { connection } = require('./queueService');

    // Check if Redis is available
    if (!connection) {
        console.warn('[Worker] Redis not available - workers cannot start. Set REDIS_URL to enable background jobs.');
        workersRunning = false;
        return;
    }
    
    workersRunning = true;

    // Single queue for all scheduled tasks
    schedulerQueue = new Queue('scheduler', {
        connection,
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    });

    // CRITICAL: Create worker for 'reminders' queue to process actual notification sending
    reminderWorker = new Worker('reminders', async (job) => {
        const { processNotification } = require('./notificationService');
        const { notificationId } = job.data;
        
        if (!notificationId) {
            console.warn('[Reminder Worker] Missing notificationId in job data');
            return { success: false, reason: 'Missing notificationId' };
        }

        try {
            await processNotification(notificationId);
            return { success: true, notificationId };
        } catch (err) {
            console.error(`[Reminder Worker] Failed to process notification ${notificationId}:`, err.message);
            throw err; // Let BullMQ handle retries
        }
    }, {
        connection,
        concurrency: 5, // Process up to 5 reminders concurrently
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    });

    reminderWorker.on('completed', (job) => {
        console.info(`[Reminder Worker] Notification ${job.data.notificationId} sent successfully`);
    });

reminderWorker.on('failed', (job, err) => {
         console.error(`[Reminder Worker] Notification ${job?.data?.notificationId} failed: ${err.message}`);
         // Don't re-throw — BullMQ handles retries automatically
       });

       reminderWorker.on('error', (err) => {
         console.error(`[Reminder Worker] Unexpected error: ${err.message}`);
       });

    console.info('✅ BullMQ reminder worker started (processes notification sending)');

    // Register repeatable jobs — BullMQ ensures only one fires per interval cluster-wide
    schedulerQueue.add('process-notifications', {}, {
        repeat: { every: 60000 }, // every 1 minute
        jobId: 'process-notifications',
    }).catch(err => console.warn('[Scheduler] Failed to register process-notifications:', err.message));

    schedulerQueue.add('process-scheduled-sms', {}, {
        repeat: { every: 60000 }, // every 1 minute
        jobId: 'process-scheduled-sms',
    }).catch(err => console.warn('[Scheduler] Failed to register process-scheduled-sms:', err.message));

    // Worker that processes the scheduled tasks
    schedulerWorker = new Worker('scheduler', async (job) => {
        if (job.name === 'process-notifications') {
            const pending = await getDueNotifications();
            const { safeAddReminder } = require('./queueService');
            let enqueued = 0;
            for (const item of pending) {
                const j = await safeAddReminder({ notificationId: item.id });
                if (!j) continue;
                await markNotificationEnqueued(item.id);
                enqueued++;
            }
            if (enqueued > 0) console.info(`[Scheduler] Enqueued ${enqueued} notification jobs`);
            return { enqueued };
        }

        if (job.name === 'process-scheduled-sms') {
            const count = await processScheduledMissedCalls();
            if (count > 0) console.info(`[Scheduler] Processed ${count} scheduled SMS(es)`);
            return { processed: count };
        }
    }, {
        connection,
        concurrency: 1, // serial execution — prevents overlapping runs
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
    });

    schedulerWorker.on('failed', (job, err) => {
        console.error(`[Scheduler] Job ${job?.name} failed: ${err.message}`);
    });

    console.info('✅ BullMQ scheduler worker started (cluster-safe repeatable jobs)');
}

module.exports = { 
    startNotificationWorker, 
    get schedulerWorker() { return schedulerWorker; },
    get reminderWorker() { return reminderWorker; },
    get isRunning() { return workersRunning; }
};
