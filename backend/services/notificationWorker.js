const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { triggerWebhook } = require('./webhookService');

/**
 * Worker to process scheduled notifications.
 * Sends 'notification.send' event to n8n for real SMS/WhatsApp delivery.
 */
function startNotificationWorker() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log('Checking for scheduled notifications...');
        const now = new Date();

        try {
            const pendingNotifications = await prisma.notification.findMany({
                where: {
                    status: 'SCHEDULED',
                    scheduledFor: { lte: now }
                },
                include: { clinic: true } // Need clinic info for the SMS
            });

            for (const notification of pendingNotifications) {
                console.log(`Sending notification ${notification.id} via n8n...`);

                // Trigger n8n Webhook for SMS/WhatsApp
                await triggerWebhook('notification.send', {
                    notificationId: notification.id,
                    type: notification.type,
                    message: notification.message,
                    clinicName: notification.clinic.name,
                    clinicPhone: notification.clinic.phone
                }, notification.clinic.webhookUrl);

                await prisma.notification.update({
                    where: { id: notification.id },
                    data: { status: 'SENT', sentAt: new Date() }
                });
            }
        } catch (error) {
            console.error('Notification Worker Error:', error);
        }
    });
}

/**
 * Worker to handle post-appointment follow-ups and marketing
 */
function startFollowUpWorker() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Checking for completed appointments for follow-up...');
        // Logic to find COMPLETED appointments and send rating requests
        // or find patients due for 6-month checkup
    });
}

module.exports = { startNotificationWorker, startFollowUpWorker };
