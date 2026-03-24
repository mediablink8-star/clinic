const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

const DISABLE_REDIS = process.env.DISABLE_REDIS === 'true';

// Resilient Redis Connection
let connection = null;
if (!DISABLE_REDIS) {
    connection = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            return delay;
        }
    });

    connection.on('error', (err) => {
        // Only log once to avoid flooding if it's a permanent disconnect
        if (err.code === 'ECONNREFUSED') {
            console.warn(`[Redis] Connection refused at ${REDIS_URL}. Queue services will be offline.`);
        } else {
            console.error('[Redis] Error:', err.message);
        }
    });

    connection.on('connect', () => {
        console.log('[Redis] Connected successfully.');
    });
}

// 1. Define Queues
let reminderQueue = null;
if (!DISABLE_REDIS) {
    reminderQueue = new Queue('reminders', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 }
        }
    });
}

// 2. Define Worker Logic
let reminderWorker = null;
if (!DISABLE_REDIS) {
    reminderWorker = new Worker('reminders', async (job) => {
        const { notificationId } = job.data;
        console.log(`[BullMQ] Processing notification ${notificationId}...`);

        // All business logic lives in notificationService — worker is a dumb executor
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
}

let queueEvents = null;
if (!DISABLE_REDIS) {
    queueEvents = new QueueEvents('reminders', { connection });

    queueEvents.on('completed', ({ jobId }) => {
        console.log(`[BullMQ] Job ${jobId} completed successfully`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`[BullMQ] Job ${jobId} failed: ${failedReason}`);
    });
}

const safeAddReminder = async (data) => {
    // Check if redis is connected before adding to queue
    if (DISABLE_REDIS || !connection || connection.status !== 'ready') {
        console.warn(`[Queue] Redis disabled or not ready. Skipping background job.`);
        return null;
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
