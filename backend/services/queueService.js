const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// No DISABLE_REDIS bypass in production. Redis is strictly required.// Resilient Redis Connection
const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
});

connection.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        console.error(`[Redis] FATAL: Connection refused at ${REDIS_URL}. Redis is required for queue services.`);
    } else {
        console.error('[Redis] Error:', err.message);
    }
});

connection.on('connect', () => {
    console.log('[Redis] Connected successfully.');
});

// 1. Define Queues
const reminderQueue = new Queue('reminders', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
    }
});

// 2. Define Worker Logic
const reminderWorker = new Worker('reminders', async (job) => {
    const { notificationId } = job.data;

    // All business logic lives in notificationService
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
});

const queueEvents = new QueueEvents('reminders', { connection });

queueEvents.on('completed', () => {});

queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[BullMQ] Job ${jobId} failed: ${failedReason}`);
});

const safeAddReminder = async (data) => {
    if (connection.status !== 'ready') {
        console.warn(`[Queue] Redis is not ready. Job may be delayed.`);
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
