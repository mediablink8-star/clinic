const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { sendManagedSms } = require('./messagingService');

/**
 * Process a single queued notification job.
 * Called by the BullMQ worker — contains ALL business logic for notification delivery.
 * Worker must only call this and handle the result.
 */

const logPrefix = '[NotificationService]';

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
         console.warn(`${logPrefix} Already processed or not found: ${notificationId}`);
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
         console.error(`${logPrefix} Notification vanished after claim: ${notificationId}`);
         return { success: false, reason: 'Notification not found after claim' };
     }

     const clinic = notification.clinic;
     if (clinic.messageCredits < 1) {
         console.warn(`${logPrefix} Insufficient credits for notification ${notificationId}`);
         await prisma.notification.update({
             where: { id: notificationId },
             data: { status: 'FAILED', error: 'Insufficient credits' }
         });
         return { success: false, reason: 'Insufficient message credits' };
     }
     if (clinic.dailyUsedCount >= clinic.dailyMessageCap) {
         console.warn(`${logPrefix} Daily cap reached for clinic ${clinic.id}, notification ${notificationId}`);
         await prisma.notification.update({
             where: { id: notificationId },
             data: { status: 'SCHEDULED' }
         });
         return { success: false, reason: 'Daily message cap reached' };
     }

     // Trigger webhook outside transaction — network call must not hold a DB connection
     try {
         console.info(`${logPrefix} Processing notification ${notificationId} for clinic ${clinic.id}`);
         await sendManagedSms({
             clinicId: clinic.id,
             clinic,
             eventType: 'notification.send',
             payload: {
                 notificationId: notification.id,
                 type: notification.type,
                 message: notification.message,
                 clinicName: clinic.name,
                 phone: notification.appointment?.patient?.phone || null,
                 patientName: notification.appointment?.patient?.name || null,
                 appointmentId: notification.appointmentId || null,
             },
             logType: notification.type,
         });

         await prisma.notification.update({ where: { id: notificationId }, data: { status: 'SENT', sentAt: new Date() } });
         console.info(`${logPrefix} Notification ${notificationId} sent successfully`);

         return { success: true };
     } catch (sendError) {
         console.error(`${logPrefix} Failed to send notification ${notificationId}: ${sendError.message}`);
         await prisma.notification.update({
             where: { id: notificationId },
             data: { status: 'FAILED', error: sendError.message }
         });
         return { success: false, reason: sendError.message };
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
