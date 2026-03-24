const { startNotificationWorker, startFollowUpWorker, startScheduledSmsWorker } = require('./services/notificationWorker');
const { reminderWorker } = require('./services/queueService'); // Import to start worker
require('dotenv').config();

console.log('🚀 SaaS-Grade Background Worker process starting...');

// Start enqueuers
startNotificationWorker();
startFollowUpWorker();
startScheduledSmsWorker();

console.log('✅ Background Workers (Cron & BullMQ) are running.');

// Keep process alive
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing worker');
    process.exit(0);
});
