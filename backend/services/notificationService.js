const { PrismaClient } = require('@prisma/client');
const { triggerWebhook } = require('./webhookService');
const AppError = require('../errors/AppError');

const prisma = new PrismaClient();

/**
 * Process a single queued notification job.
 * Called by the BullMQ worker — contains ALL business logic for notification delivery.
 * Worker must only call this and handle the result.
 */
async function processNotification(notificationId) {
    const result = await prisma.$transaction(async (tx) => {
        const notification = await tx.notification.findUnique({
            where: { id: notificationId },
            include: { clinic: true }
        });

        if (!notification) {
            return { success: false, reason: 'Notification not found' };
        }

        if (notification.status !== 'SCHEDULED' && notification.status !== 'ENQUEUED') {
            return { success: false, reason: 'Already processed' };
        }

        const clinic = notification.clinic;
        const dailyCost = 1;

        if (clinic.messageCredits < dailyCost) {
            throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
        }
        if (clinic.dailyUsedCount >= clinic.dailyMessageCap) {
            throw new AppError('DAILY_CAP_REACHED', 'Daily message cap reached', 429);
        }

        // Deduct credits atomically with log creation
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

        return { notification, clinic, log };
    });

    // Already processed — not an error, just skip
    if (!result.notification) return { success: false, reason: result.reason };

    const { notification, clinic, log } = result;

    // Trigger webhook outside transaction — network call must not hold a DB connection
    try {
        await triggerWebhook(
            'notification.send',
            {
                notificationId: notification.id,
                type: notification.type,
                message: notification.message,
                clinicName: clinic.name
            },
            clinic.webhookUrl
        );

        await prisma.$transaction([
            prisma.messageLog.update({ where: { id: log.id }, data: { status: 'SENT' } }),
            prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT', sentAt: new Date() } })
        ]);

        return { success: true };
    } catch (sendError) {
        await prisma.messageLog.update({
            where: { id: log.id },
            data: { status: 'FAILED', error: sendError.message }
        });
        // Re-throw so BullMQ can retry
        throw new AppError('DELIVERY_FAILED', sendError.message, 502);
    }
}

/**
 * Enqueue due notifications — called by cron, no business logic here.
 * Returns count of enqueued items.
 */
async function getDueNotifications() {
    const now = new Date();
    return prisma.notification.findMany({
        where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
        select: { id: true }
    });
}

async function markNotificationEnqueued(notificationId) {
    return prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'ENQUEUED' }
    });
}

module.exports = { processNotification, getDueNotifications, markNotificationEnqueued };
