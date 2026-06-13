const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { sendSmsWithTracking } = require('./twilioService');
const logger = require('../utils/logger');

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
         logger.warn('Notification already processed or not found during claim', { notificationId });
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
         logger.error('Notification vanished after claim', { notificationId });
         return { success: false, reason: 'Notification not found after claim' };
     }

     const clinic = notification.clinic;
     if (clinic.messageCredits < 1) {
         logger.warn('Insufficient credits for notification', { notificationId, clinicId: clinic.id });
         await prisma.notification.update({
             where: { id: notificationId },
             data: { status: 'FAILED', error: 'Insufficient credits' }
         });
         return { success: false, reason: 'Insufficient message credits' };
     }
     if (clinic.dailyUsedCount >= clinic.dailyMessageCap) {
        logger.warn('NotificationService Daily cap reached', { clinicId: clinic.id, notificationId });
        await prisma.notification.update({
            where: { id: notificationId },
            data: { status: 'SCHEDULED' }
        });
        return { success: false, reason: 'Daily message cap reached' };
     }

      // Trigger webhook outside transaction — network call must not hold a DB connection
      try {
          logger.info('Processing notification', { notificationId, clinicId: clinic.id });
          const phone = notification.appointment?.patient?.phone;
          if (!phone) throw new Error('No patient phone number for notification');

          const result = await sendSmsWithTracking({
              to: phone,
              body: notification.message,
              clinicId: clinic.id,
          });
          if (!result.success) throw new Error(result.error || 'Twilio send failed');

          await prisma.notification.update({ where: { id: notificationId }, data: { status: 'SENT', sentAt: new Date() } });
          logger.info('Notification sent successfully', { notificationId });

          return { success: true };
      } catch (sendError) {
         logger.error('Failed to send notification', { err: sendError, notificationId });
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
