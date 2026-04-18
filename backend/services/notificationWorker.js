const { Queue, Worker } = require('bullmq');
const { getDueNotifications, markNotificationEnqueued } = require('./notificationService');
const { processScheduledMissedCalls } = require('./missedCallService');
const { processFollowUps } = require('./followUpService');

/**
 * Cluster-safe background workers using BullMQ repeatable jobs.
 * Redis distributed locking ensures jobs fire exactly once across all instances.
 * 
 * Replaces node-cron which would fire on every server instance causing duplicate SMS.
 */

let schedulerQueue = null;
let schedulerWorker = null;

function startNotificationWorker() {
    const { connection } = require('./queueService');

    // Single queue for all scheduled tasks
    schedulerQueue = new Queue('scheduler', {
        connection,
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    });

    // Register repeatable jobs — BullMQ ensures only one fires per interval cluster-wide
    schedulerQueue.add('process-notifications', {}, {
        repeat: { every: 60000 }, // every 1 minute
        jobId: 'process-notifications',
    }).catch(err => console.warn('[Scheduler] Failed to register process-notifications:', err.message));

    schedulerQueue.add('process-scheduled-sms', {}, {
        repeat: { every: 60000 }, // every 1 minute
        jobId: 'process-scheduled-sms',
    }).catch(err => console.warn('[Scheduler] Failed to register process-scheduled-sms:', err.message));

    schedulerQueue.add('process-followups', {}, {
        repeat: { every: 5 * 60000 }, // every 5 minutes
        jobId: 'process-followups',
    }).catch(err => console.warn('[Scheduler] Failed to register process-followups:', err.message));

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
            if (enqueued > 0) console.log(`[Scheduler] Enqueued ${enqueued} notification jobs`);
            return { enqueued };
        }

        if (job.name === 'process-scheduled-sms') {
            const count = await processScheduledMissedCalls();
            if (count > 0) console.log(`[Scheduler] Processed ${count} scheduled SMS(es)`);
            return { processed: count };
        }

        if (job.name === 'process-followups') {
            const result = await processFollowUps();
            if (result.followUp1 + result.followUp2 > 0) {
                console.log(`[Scheduler] Follow-ups sent: F1=${result.followUp1} F2=${result.followUp2}`);
            }
            return result;
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

    console.log('✅ BullMQ scheduler worker started (cluster-safe repeatable jobs)');
}

// Legacy exports kept for backward compatibility
function startFollowUpWorker() {}
function startScheduledSmsWorker() {}

module.exports = { startNotificationWorker, startFollowUpWorker, startScheduledSmsWorker };
