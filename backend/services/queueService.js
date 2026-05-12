const { Queue } = require('bullmq');
const Redis = require('ioredis');
const prisma = require('./prisma');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Only disable Redis if explicitly told to. In production without REDIS_URL, warn loudly.
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test';

let connection = null;

if (REDIS_DISABLED) {
    console.warn('[Redis] Disabled via DISABLE_REDIS=true — using DB fallback for background jobs.');
} else {
    try {
        connection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                if (times > 10) {
                    console.error('[Redis] Max retries reached — disabling Redis for this session.');
                    return null; // stop retrying
                }
                const delay = Math.min(times * 5000, 60000); // 5s, 10s, ... up to 60s
                console.warn(`[Redis] Retrying connection (attempt ${times}) in ${delay}ms...`);
                return delay;
            },
            reconnectOnError(err) {
                // Only reconnect on network errors, not quota errors
                if (err.message.includes('max requests limit exceeded')) {
                    console.error('[Redis] Quota exceeded — not reconnecting.');
                    return false;
                }
                return true;
            }
        });

        connection.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                console.error(`[Redis] Connection refused at ${REDIS_URL}. Falling back to DB.`);
            } else if (err.code === 'ENOTFOUND') {
                console.error(`[Redis] Host not found: ${REDIS_URL}. Falling back to DB.`);
            } else {
                console.error('[Redis] Error:', err.message);
            }
        });
        connection.on('connect', () => {
            console.info('[Redis] Connected successfully.');
        });
        connection.on('close', () => {
            console.warn('[Redis] Connection closed. Using DB fallback.');
        });
    } catch (err) {
        console.error('[Redis] Failed to initialize connection:', err.message);
        connection = null;
    }
}

const reminderQueue = !REDIS_DISABLED && connection ? new Queue('reminders', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
    }
}) : null;

const safeAddReminder = async (data) => {
    if (!data || !data.notificationId) {
        console.error('[Queue] Invalid job data - notificationId required');
        return null;
    }

    // Try Redis first
    if (!REDIS_DISABLED && connection && reminderQueue) {
        try {
            if (connection.status === 'ready') {
                const job = await reminderQueue.add('reminder-job', data);
                console.info(`[Queue] Job ${data.notificationId} added to Redis`);
                return job;
            }
        } catch (err) {
            console.warn(`[Queue] Redis failed, falling back to DB: ${err.message}`);
        }
    }

    // DB fallback: mark notification as pending for cron to pick up
    try {
        await prisma.notification.update({
            where: { id: data.notificationId },
            data: { status: 'SCHEDULED' }
        });
        console.info(`[Queue] DB Fallback: Notification ${data.notificationId} marked as SCHEDULED`);
        return { fallback: true, notificationId: data.notificationId };
    } catch (err) {
        console.error(`[Queue] DB fallback failed for ${data.notificationId}:`, err.message);
        return null;
    }
};

const isRedisHealthy = () => !REDIS_DISABLED && connection && connection.status === 'ready';

module.exports = {
    REDIS_DISABLED,
    reminderQueue,
    safeAddReminder,
    connection,
    isRedisHealthy
};
