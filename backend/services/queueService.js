const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true' || (!process.env.REDIS_URL && process.env.NODE_ENV === 'production');

if (REDIS_DISABLED) {
    console.log('[Redis] Disabled — queue features unavailable. Set REDIS_URL to enable.');
}

const connection = REDIS_DISABLED ? null : new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
});

if (connection) {
    connection.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
            console.error(`[Redis] Connection refused at ${REDIS_URL}.`);
        } else {
            console.error('[Redis] Error:', err.message);
        }
    });
    connection.on('connect', () => {
        console.log('[Redis] Connected successfully.');
    });
}

const reminderQueue = !REDIS_DISABLED ? new Queue('reminders', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
    }
}) : null;

const reminderWorker = !REDIS_DISABLED ? new Worker('reminders', async (job) => {
    const { notificationId } = job.data;
    const { processNotification } = require('./notificationService');
    const result = await processNotification(notificationId);
    if (!result.success) {
        console.warn(`[BullMQ] Notification ${notificationId} skipped: ${result.reason}`);
    }
    return result;
}, {
    connection,
    concurrency: 10,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 }
}) : null;

const queueEvents = !REDIS_DISABLED ? new QueueEvents('reminders', { connection }) : null;

if (queueEvents) {
    queueEvents.on('completed', () => {});
    queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`[BullMQ] Job ${jobId} failed: ${failedReason}`);
    });
}

const safeAddReminder = async (data) => {
    if (REDIS_DISABLED || !connection) {
        console.warn('[Queue] Redis disabled — job skipped');
        return null;
    }
    if (connection.status !== 'ready') {
        console.warn('[Queue] Redis is not ready. Job may be delayed.');
    }
    try {
        return await reminderQueue.add('reminder-job', data);
    } catch (err) {
        console.error('[Queue] Failed to add job:', err.message);
        return null;
    }
};

module.exports = {
    reminderQueue,
    reminderWorker,
    safeAddReminder,
    connection
};
