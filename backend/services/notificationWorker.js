const { Queue, Worker } = require('bullmq');
const { getDueNotifications, markNotificationEnqueued, processNotification } = require('./notificationService');
const { processScheduledMissedCalls } = require('./missedCallService');
const logger = require('../utils/logger');

let schedulerQueue = null;
let schedulerWorker = null;
let reminderWorker = null;
let fallbackTimer = null;
let fallbackRunning = false;
let fallbackStartedAt = null;
let workersRunning = false;
let workerMode = 'stopped';

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS || 60000);

const STUCK_FLAG_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

async function runDbFallbackTick() {
    if (fallbackRunning) {
        // Check if flag has been stuck for too long
        if (fallbackStartedAt && Date.now() - fallbackStartedAt > STUCK_FLAG_THRESHOLD_MS) {
            logger.error('DB fallback worker flag stuck for >5min — force resetting. Possible unhandled error.');
            fallbackRunning = false;
            fallbackStartedAt = null;
            // Fall through to re-run
        } else {
            logger.warn('DB fallback worker tick skipped because previous tick is still running');
            return;
        }
    }

    fallbackRunning = true;
    fallbackStartedAt = Date.now();
    try {
        const pending = await getDueNotifications();
        let sentNotifications = 0;

        for (const item of pending) {
            const result = await processNotification(item.id);
            if (result.success) sentNotifications++;
        }

        const missedCallResult = await processScheduledMissedCalls();
        if (sentNotifications > 0 || missedCallResult.processed > 0) {
            logger.info('DB fallback worker processed jobs', {
                sentNotifications,
                processedMissedCalls: missedCallResult.processed,
                scheduledSmsSucceeded: missedCallResult.succeeded,
                scheduledSmsFailed: missedCallResult.failed
            });
        }
    } catch (err) {
        logger.error('DB fallback worker tick failed', { err });
    } finally {
        fallbackRunning = false;
        fallbackStartedAt = null;
    }
}

function startDbFallbackWorker(reason) {
    if (fallbackTimer) return { close: stopNotificationWorker, mode: 'db-fallback' };

    workersRunning = true;
    workerMode = 'db-fallback';
    logger.warn('Starting DB polling fallback worker', {
        reason,
        pollIntervalMs: POLL_INTERVAL_MS
    });

    runDbFallbackTick().catch(err => logger.error('Initial DB fallback worker tick failed', { err }));
    fallbackTimer = setInterval(() => {
        runDbFallbackTick().catch(err => logger.error('DB fallback worker interval failed', { err }));
    }, POLL_INTERVAL_MS);

    return { close: stopNotificationWorker, mode: 'db-fallback' };
}

/**
 * Archive webhook delivery records older than 90 days.
 * Called once daily via cron in the worker process.
 */
async function archiveOldWebhookDeliveries() {
    const RETENTION_DAYS = Number(process.env.WEBHOOK_DELIVERY_RETENTION_DAYS || 90);
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    try {
        const result = await require('./prisma').webhookDelivery.deleteMany({
            where: { createdAt: { lt: cutoff } },
        });
        if (result.count > 0) {
            logger.info('Archived old webhook deliveries', { deleted: result.count, olderThanDays: RETENTION_DAYS });
        }
    } catch (err) {
        logger.warn('Webhook delivery archival failed', { error: err.message });
    }
}

function startNotificationWorker() {
    const { connection, REDIS_DISABLED } = require('./queueService');

    if (REDIS_DISABLED || !connection) {
        return startDbFallbackWorker(REDIS_DISABLED ? 'redis-disabled' : 'missing-redis-connection');
    }

    workersRunning = true;
    workerMode = 'bullmq';

    schedulerQueue = new Queue('scheduler', {
        connection,
        defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    });

    reminderWorker = new Worker('reminders', async (job) => {
        const { notificationId } = job.data;

        if (!notificationId) {
            logger.warn('Reminder Worker Missing notificationId in job data');
            return { success: false, reason: 'Missing notificationId' };
        }

        const result = await processNotification(notificationId);
        if (!result.success) {
            logger.warn('Notification job finished without sending', {
                notificationId,
                reason: result.reason
            });
        }
        return { ...result, notificationId };
    }, {
        connection,
        concurrency: 5,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
    });

    reminderWorker.on('completed', (job) => {
        logger.info('Notification job completed', { notificationId: job.data.notificationId });
    });

    reminderWorker.on('failed', (job, err) => {
        logger.error('Reminder Worker Notification failed', { notificationId: job?.data?.notificationId, error: err.message });
    });

    reminderWorker.on('error', (err) => {
        logger.error('Reminder Worker Unexpected error', { error: err.message });
    });

    schedulerQueue.add('process-notifications', {}, {
        repeat: { every: POLL_INTERVAL_MS },
        jobId: 'process-notifications',
    }).catch(err => logger.warn('Scheduler Failed to register process-notifications', { error: err.message }));

    schedulerQueue.add('process-scheduled-sms', {}, {
        repeat: { every: POLL_INTERVAL_MS },
        jobId: 'process-scheduled-sms',
    }).catch(err => logger.warn('Scheduler Failed to register process-scheduled-sms', { error: err.message }));

    schedulerWorker = new Worker('scheduler', async (job) => {
        if (job.name === 'process-notifications') {
            const pending = await getDueNotifications();
            const { safeAddReminder } = require('./queueService');
            let enqueued = 0;
            for (const item of pending) {
                const queued = await safeAddReminder({ notificationId: item.id });
                if (!queued) continue;
                await markNotificationEnqueued(item.id);
                enqueued++;
            }
            if (enqueued > 0) logger.info('Enqueued notification jobs', { count: enqueued });
            return { enqueued };
        }

        if (job.name === 'process-scheduled-sms') {
            const result = await processScheduledMissedCalls();
            if (result.processed > 0) logger.info('Scheduler Processed scheduled SMS(es)', result);
            return result;
        }

        return { skipped: true };
    }, {
        connection,
        concurrency: 1,
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
    });

    schedulerWorker.on('failed', (job, err) => {
        logger.error('Scheduler Job failed', { jobName: job?.name, error: err.message });
    });

    schedulerWorker.on('error', (err) => {
        logger.error('Scheduler Unexpected error', { error: err.message });
    });

    logger.info('BullMQ background workers started');

    // Schedule daily webhook delivery archival (runs at 3 AM server time)
    const cron = require('node-cron');
    cron.schedule('0 3 * * *', () => {
        archiveOldWebhookDeliveries().catch(err => logger.error('Archival cron failed', { error: err.message }));
    });
    logger.info('Webhook delivery archival cron scheduled (daily 3AM)');

    return { close: stopNotificationWorker, mode: 'bullmq' };
}

async function stopNotificationWorker() {
    workersRunning = false;
    workerMode = 'stopped';

    if (fallbackTimer) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
    }

    await Promise.allSettled([
        reminderWorker?.close(),
        schedulerWorker?.close(),
        schedulerQueue?.close(),
    ]);

    reminderWorker = null;
    schedulerWorker = null;
    schedulerQueue = null;
}

module.exports = {
    startNotificationWorker,
    stopNotificationWorker,
    archiveOldWebhookDeliveries,
    get schedulerWorker() { return schedulerWorker; },
    get reminderWorker() { return reminderWorker; },
    get isRunning() { return workersRunning; },
    get mode() { return workerMode; }
};
