const { Queue } = require('bullmq');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL;
const HAS_REDIS = Boolean(REDIS_URL);

let connection = null;
let recoveryQueue = null;

if (HAS_REDIS) {
    const Redis = require('ioredis');
    connection = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
            if (times > 10) {
                logger.error('RecoveryQueue: Redis max retries reached');
                return null;
            }
            return Math.min(times * 5000, 60000);
        }
    });

    recoveryQueue = new Queue('recovery', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 500 },
            removeOnFail: { count: 1000 },
        }
    });

    logger.info('RecoveryQueue: BullMQ queue initialized');
} else {
    logger.warn('RecoveryQueue: REDIS_URL not set — recovery jobs will run inline (no durability)');
}

/**
 * Enqueue a missed-call recovery job.
 * Returns { queued: true, jobId } if BullMQ is available,
 * or { queued: false } to signal the caller should run inline.
 */
async function enqueueRecovery({ phone, clinicId, callSid, force = false }) {
    if (recoveryQueue && connection && connection.status === 'ready') {
        try {
            const job = await recoveryQueue.add('process-recovery', {
                phone,
                clinicId,
                callSid,
                force,
            }, {
                jobId: callSid ? `recovery:${callSid}` : undefined,
            });
            logger.info('RecoveryQueue: job enqueued', { callSid, jobId: job.id });
            return { queued: true, jobId: job.id };
        } catch (err) {
            // BullMQ throws on duplicate jobId — this is expected dedup behavior
            if (err.message?.includes('duplicate')) {
                logger.info('RecoveryQueue: duplicate job skipped', { callSid });
                return { queued: true, jobId: null, duplicate: true };
            }
            logger.warn('RecoveryQueue: enqueue failed, will run inline', { callSid, error: err.message });
            return { queued: false };
        }
    }
    return { queued: false };
}

module.exports = { connection, recoveryQueue, enqueueRecovery, HAS_REDIS };
