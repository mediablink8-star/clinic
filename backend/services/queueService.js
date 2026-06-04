const { Queue } = require('bullmq');
const Redis = require('ioredis');
const prisma = require('./prisma');
const logger = require('../utils/logger');

const HAS_REDIS_URL = Boolean(process.env.REDIS_URL);
const REDIS_URL = process.env.REDIS_URL || (process.env.NODE_ENV === 'production' ? null : 'redis://127.0.0.1:6379');

// Disable Redis when explicitly requested, during tests, or when production has no Redis URL.
const REDIS_DISABLED = process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test' || !REDIS_URL;

let connection = null;

if (REDIS_DISABLED) {
    if (!HAS_REDIS_URL && process.env.NODE_ENV === 'production') {
        logger.warn('REDIS_URL is not set in production - using DB polling fallback for background jobs.');
    } else {
        logger.info('Redis disabled - using DB fallback for background jobs.');
    }
} else {
    try {
        connection = new Redis(REDIS_URL, {
            maxRetriesPerRequest: null,
            enableReadyCheck: false,
            retryStrategy(times) {
                if (times > 10) {
                    logger.error('Redis Max retries reached - DB polling fallback should take over on next process restart.');
                    return null;
                }
                const delay = Math.min(times * 5000, 60000);
                logger.warn('Redis retrying connection', { attempt: times, delay });
                return delay;
            },
            reconnectOnError(err) {
                if (err.message.includes('max requests limit exceeded')) {
                    logger.error('Redis Quota exceeded - not reconnecting.');
                    return false;
                }
                return true;
            }
        });

        connection.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                logger.error('Redis Connection refused', { url: REDIS_URL });
            } else if (err.code === 'ENOTFOUND') {
                logger.error('Redis Host not found', { url: REDIS_URL });
            } else {
                logger.error('Redis Error', { error: err.message });
            }
        });
        connection.on('connect', () => {
            logger.info('Redis connected successfully');
        });
        connection.on('close', () => {
            logger.warn('Redis Connection closed.');
        });
    } catch (err) {
        logger.error('Redis Failed to initialize connection', { error: err.message });
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
        logger.error('Queue Invalid job data - notificationId required');
        return null;
    }

    if (!REDIS_DISABLED && connection && reminderQueue) {
        try {
            if (connection.status === 'ready') {
                const job = await reminderQueue.add('reminder-job', data);
                logger.info('Queue Job added to Redis', { notificationId: data.notificationId });
                return job;
            }
        } catch (err) {
            logger.warn('Queue Redis failed, falling back to DB', { error: err.message });
        }
    }

    try {
        await prisma.notification.update({
            where: { id: data.notificationId },
            data: { status: 'SCHEDULED' }
        });
        logger.info('Queue DB fallback activated', { notificationId: data.notificationId });
        return { fallback: true, notificationId: data.notificationId };
    } catch (err) {
        logger.error('Queue DB fallback failed', { notificationId: data.notificationId, error: err.message });
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
