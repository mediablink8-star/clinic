const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const { PrismaClient } = require('@prisma/client');
const { triggerWebhook } = require('./webhookService');

const prisma = new PrismaClient();
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

    try {
        const result = await prisma.$transaction(async (tx) => {
            const notification = await tx.notification.findUnique({
                where: { id: notificationId },
                include: { clinic: true }
            });

            if (!notification || notification.status !== 'SCHEDULED') {
                return { success: false, reason: 'Already processed or not found' };
            }

            const clinic = await tx.clinic.findUnique({ where: { id: notification.clinicId } });
            const today = new Date();
            const dailyCost = 1;

            // Simple Credit & Cap Check
            if (clinic.messageCredits < dailyCost) throw new Error('INSUFFICIENT_CREDITS');
            if (clinic.dailyUsedCount >= clinic.dailyMessageCap) throw new Error('DAILY_CAP_REACHED');

            // Deduct
            await tx.clinic.update({
                where: { id: clinic.id },
                data: {
                    messageCredits: { decrement: dailyCost },
                    dailyUsedCount: { increment: dailyCost }
                }
            });

            const log = await tx.messageLog.create({
                data: { clinicId: clinic.id, type: notification.type, cost: dailyCost, status: 'PENDING' }
            });

            // Trigger External
            try {
                await triggerWebhook('notification.send', {
                    notificationId: notification.id,
                    type: notification.type,
                    message: notification.message,
                    clinicName: notification.clinic.name
                }, notification.clinic.webhookUrl);

                await tx.messageLog.update({ where: { id: log.id }, data: { status: 'SENT' } });
                await tx.notification.update({ where: { id: notification.id }, data: { status: 'SENT', sentAt: new Date() } });

                return { success: true };
            } catch (sendError) {
                await tx.messageLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: sendError.message } });
                return { success: false, error: sendError.message };
            }
        });

        return result;
    } catch (error) {
        console.error(`[BullMQ] Job ${job.id} failed:`, error.message);
        throw error; // Let BullMQ handle retries
    }
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
