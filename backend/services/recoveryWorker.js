const { Worker } = require('bullmq');
const prisma = require('./prisma');
const { handleMissedCall } = require('./missedCallService');
const { sendSmsFailureAlert } = require('./emailService');
const logger = require('../utils/logger');

function startRecoveryWorker(connection) {
    if (!connection) {
        logger.warn('RecoveryWorker: no Redis connection — skipped');
        return null;
    }

    const worker = new Worker('recovery', async (job) => {
        const { phone, clinicId, callSid, force } = job.data;
        const attempt = (job.attemptsMade || 0) + 1;
        logger.info('RecoveryWorker: processing', { callSid, attempt });

        const result = await handleMissedCall({
            phone,
            clinicId,
            callSid,
            force,
            bypassCooldown: true,
        });

        if (!result.success) {
            throw new Error('Recovery failed');
        }

        return result;
    }, {
        connection,
        concurrency: 3,
        limiter: { max: 10, duration: 1000 },
    });

    worker.on('completed', (job) => {
        logger.info('RecoveryWorker: job completed', { callSid: job.data.callSid });
    });

    worker.on('failed', (job, err) => {
        logger.error('RecoveryWorker: job failed permanently', {
            callSid: job?.data?.callSid,
            attempts: job?.attemptsMade,
            error: err.message,
        });

        // Alert clinic owner after final failure
        if (job?.data?.clinicId) {
            prisma.user.findFirst({
                where: { clinicId: job.data.clinicId, role: { in: ['OWNER', 'ADMIN'] } },
                select: { email: true }
            }).then(owner => {
                if (owner?.email) {
                    prisma.clinic.findUnique({ where: { id: job.data.clinicId }, select: { name: true } })
                        .then(clinic => {
                            sendSmsFailureAlert(
                                owner.email,
                                clinic?.name || 'Clinic',
                                job.data.phone || 'unknown',
                                `Recovery job failed permanently: ${err.message}`
                            ).catch(() => {});
                        });
                }
            }).catch(() => {});
        }
    });

    worker.on('error', (err) => {
        logger.error('RecoveryWorker: unexpected error', { error: err.message });
    });

    logger.info('RecoveryWorker: started');
    return worker;
}

module.exports = { startRecoveryWorker };
