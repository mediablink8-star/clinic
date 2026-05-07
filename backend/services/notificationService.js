const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { sendManagedSms } = require('./messagingService');

/**
 * Process a single queued notification job.
 * Called by the BullMQ worker — contains ALL business logic for notification delivery.
 * Worker must only call this and handle the result.
 */
async function processNotification(notificationId) {
    // ATOMIC CLAIM: Only one worker can claim this notification
    const claimResult = await prisma.notification.updateMany({
        where: {
            id: notificationId,
            status: { in: ['SCHEDULED', 'ENQUEUED'] }
        },
        data: { status: 'PROCESSING' }
    });

    if (claimResult.count === 0) {
        return { success: false, reason: 'Already processed or not found' };
    }

    // Fetch the claimed notification with clinic and appointment+patient data
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
        include: { 
            clinic: true,
            appointment: { include: { patient: true } }
        }
    });

    if (!notification) {
        return { success: false, reason: 'Notification not found after claim' };
    }

    const clinic = notification.clinic;
    if (clinic.messageCredits < 1) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'FAILED' }
        });
        throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
    }
    if (clinic.dailyUsedCount >= clinic.dailyMessageCap) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'SCHEDULED' }
        });
        throw new AppError('DAILY_CAP_REACHED', 'Daily message cap reached', 429);
    }

    // Trigger webhook outside transaction — network call must not hold a DB connection
    try {
        await sendManagedSms({
            clinicId: clinic.id,
            clinic,
            eventType: 'notification.send',
            payload: {
                notificationId: notification.id,
                type: notification.type,
                message: notification.message,
                clinicName: clinic.name,
                // Include patient phone so n8n/webhook knows where to send the SMS
                phone: notification.appointment?.patient?.phone || null,
                patientName: notification.appointment?.patient?.name || null,
                appointmentId: notification.appointmentId || null,
            },
            logType: notification.type,
        });

        await prisma.notification.update({ where: { id: notificationId }, data: { status: 'SENT', sentAt: new Date() } });

        return { success: true };
    } catch (sendError) {
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'FAILED' }
        });
        throw new AppError('DELIVERY_FAILED', sendError.message, 502);
    }
}

/**
 * Enqueue due notifications — called by cron/automation route.
 * Supports pagination via limit + cursor to avoid unbounded queries.
 */
async function getDueNotifications({ limit = 50, cursor } = {}) {
    const now = new Date();
    return prisma.notification.findMany({
        where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
        select: { id: true },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { scheduledFor: 'asc' },
    });
}

async function markNotificationEnqueued(notificationId) {
    return prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'ENQUEUED' }
    });
}

module.exports = { processNotification, getDueNotifications, markNotificationEnqueued };
