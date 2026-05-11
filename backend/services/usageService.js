const prisma = require('./prisma');
const AppError = require('../errors/AppError');

const DEFAULT_SMS_LIMIT = Number(process.env.SMS_MONTHLY_LIMIT || 500);
const DEFAULT_AI_LIMIT = Number(process.env.AI_MONTHLY_LIMIT || 1000);
const SPIKE_SMS_THRESHOLD = Number(process.env.SMS_SPIKE_THRESHOLD || 450);
const SPIKE_AI_THRESHOLD = Number(process.env.AI_SPIKE_THRESHOLD || 900);
const DAILY_SMS_LIMIT = Number(process.env.DAILY_SMS_LIMIT || 200);
const AI_PER_MINUTE_LIMIT = Number(process.env.AI_PER_MINUTE_LIMIT || 30);
const SMS_PER_MINUTE_LIMIT = Number(process.env.SMS_PER_MINUTE_LIMIT || 40);
const SMS_BURST_LIMIT = Number(process.env.SMS_BURST_LIMIT || 12);
const BURST_WINDOW_MS = 10000;
const RATE_WINDOW_MS = 60000;
const TEMP_BLOCK_MS = Number(process.env.TEMP_SPIKE_BLOCK_MS || 5 * 60 * 1000);

const { connection, REDIS_DISABLED } = require('./queueService');

const inMemoryRate = {
    sms: new Map(),
    ai: new Map(),
    blockedUntil: new Map(),
};

function usageError(type) {
    return new AppError('USAGE_LIMIT_REACHED', 'USAGE_LIMIT_REACHED', 429, { type });
}

function rateError(type) {
    return new AppError('RATE_LIMITED', 'RATE_LIMITED', 429, { type });
}

function nowMs() {
    return Date.now();
}

async function pushAndTrim(map, clinicId, windowMs, type = null) {
    const now = nowMs();
    
    // Redis implementation
    if (!REDIS_DISABLED && connection && connection.status === 'ready' && type) {
        const key = `rate:${type}:${clinicId}`;
        try {
            const multi = connection.multi();
            multi.zadd(key, now, `${now}-${Math.random()}`);
            multi.zremrangebyscore(key, 0, now - windowMs);
            multi.zcard(key);
            multi.expire(key, Math.ceil(windowMs / 1000) + 10);
            const results = await multi.exec();
            // result format [[null, 1], [null, removedCount], [null, totalCount], [null, 1]]
            return { length: results[2][1] };
        } catch (err) {
            console.warn(`[Redis] Rate limit push failed, falling back to in-memory: ${err.message}`);
        }
    }

    // In-memory fallback
    const history = map.get(clinicId) || [];
    const next = history.filter((t) => now - t <= windowMs);
    next.push(now);
    map.set(clinicId, next);
    return next;
}

async function assertNotTemporarilyBlocked(clinicId, type) {
    let blockedUntil = 0;

    if (!REDIS_DISABLED && connection && connection.status === 'ready') {
        const key = `block:${type}:${clinicId}`;
        try {
            const val = await connection.get(key);
            blockedUntil = parseInt(val, 10) || 0;
        } catch (err) {
            console.warn(`[Redis] block check failed: ${err.message}`);
            blockedUntil = inMemoryRate.blockedUntil.get(`${type}:${clinicId}`) || 0;
        }
    } else {
        blockedUntil = inMemoryRate.blockedUntil.get(`${type}:${clinicId}`) || 0;
    }

    if (blockedUntil > nowMs()) {
        throw usageError(type);
    }
}

async function triggerTemporaryBlock(clinicId, type, reason) {
    const until = nowMs() + TEMP_BLOCK_MS;
    
    if (!REDIS_DISABLED && connection && connection.status === 'ready') {
        const key = `block:${type}:${clinicId}`;
        try {
            await connection.set(key, until, 'PX', TEMP_BLOCK_MS);
        } catch (err) {
            console.warn(`[Redis] Trigger block failed: ${err.message}`);
            inMemoryRate.blockedUntil.set(`${type}:${clinicId}`, until);
        }
    } else {
        inMemoryRate.blockedUntil.set(`${type}:${clinicId}`, until);
    }

    console.warn(`[SPIKE_BLOCK] clinic=${clinicId} type=${type} until=${new Date(until).toISOString()} reason=${reason}`);
}

async function assertRateLimits(clinicId, type) {
    const bucket = inMemoryRate[type];
    const samples = await pushAndTrim(bucket, clinicId, RATE_WINDOW_MS, type);
    const minuteLimit = type === 'ai' ? AI_PER_MINUTE_LIMIT : SMS_PER_MINUTE_LIMIT;
    if (samples.length > minuteLimit) {
        await triggerTemporaryBlock(clinicId, type, 'minute_rate_exceeded');
        throw rateError(type);
    }
    if (type === 'sms') {
        // For burst we check the same Redis key but with a smaller window
        let burstCount = 0;
        if (!REDIS_DISABLED && connection && connection.status === 'ready') {
            try {
                burstCount = await connection.zcount(`rate:${type}:${clinicId}`, nowMs() - BURST_WINDOW_MS, '+inf');
            } catch (err) {
                console.warn(`[Redis] Burst check failed: ${err.message}`);
                const now = nowMs();
                const history = bucket.get(clinicId) || [];
                burstCount = history.filter((t) => now - t <= BURST_WINDOW_MS).length;
            }
        } else {
            const now = nowMs();
            const history = bucket.get(clinicId) || [];
            burstCount = history.filter((t) => now - t <= BURST_WINDOW_MS).length;
        }

        if (burstCount > SMS_BURST_LIMIT) {
            await triggerTemporaryBlock(clinicId, type, 'burst_exceeded');
            throw rateError(type);
        }
    }
}

function startOfCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfCurrentDay() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function shouldResetUsage(lastResetDate) {
    if (!lastResetDate) return true;
    const resetDate = new Date(lastResetDate);
    const monthStart = startOfCurrentMonth();
    return resetDate < monthStart;
}

function shouldResetDailyUsage(lastDailyReset) {
    if (!lastDailyReset) return true;
    const resetDate = new Date(lastDailyReset);
    const dayStart = startOfCurrentDay();
    return resetDate < dayStart;
}

async function ensureMonthlyUsageWindow(clinicId, tx = prisma) {
    const clinic = await tx.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const updates = {};

    // Check monthly reset
    if (shouldResetUsage(clinic.lastResetDate)) {
        updates.smsCount = 0;
        updates.aiRequestCount = 0;
        updates.lastResetDate = startOfCurrentMonth();
    }

    // Check daily reset
    if (shouldResetDailyUsage(clinic.lastResetDay)) {
        updates.dailyUsedCount = 0;
        updates.lastResetDay = startOfCurrentDay();
    }

    if (Object.keys(updates).length > 0) {
        return tx.clinic.update({
            where: { id: clinicId },
            data: updates,
        });
    }

    return clinic;
}

async function assertWithinSmsLimit(clinicId, tx = prisma) {
    const clinic = await ensureMonthlyUsageWindow(clinicId, tx);
    await assertNotTemporarilyBlocked(clinicId, 'sms');
    await assertRateLimits(clinicId, 'sms');
    const limit = clinic.smsMonthlyLimit || DEFAULT_SMS_LIMIT;
    const dailyLimit = Math.min(clinic.dailyMessageCap || DAILY_SMS_LIMIT, DAILY_SMS_LIMIT);
    
    if (clinic.smsCount >= limit) {
        throw usageError('sms');
    }
    if ((clinic.dailyUsedCount || 0) >= dailyLimit) {
        throw usageError('sms');
    }
    
    return { clinic, limit, dailyLimit };
}

async function assertWithinAiLimit(clinicId, tx = prisma) {
    const clinic = await ensureMonthlyUsageWindow(clinicId, tx);
    await assertNotTemporarilyBlocked(clinicId, 'ai');
    await assertRateLimits(clinicId, 'ai');
    const limit = clinic.aiMonthlyLimit || DEFAULT_AI_LIMIT;
    
    if (clinic.aiRequestCount >= limit) {
        throw usageError('ai');
    }
    
    return { clinic, limit };
}

async function incrementSmsUsage(clinicId, tx = prisma) {
    const { limit, dailyLimit } = await assertWithinSmsLimit(clinicId, tx);
    
    try {
        return await tx.clinic.update({
            where: { 
                id: clinicId,
                smsCount: { lt: limit },
                dailyUsedCount: { lt: dailyLimit }
            },
            data: { 
                smsCount: { increment: 1 },
                dailyUsedCount: { increment: 1 }
            },
        });
    } catch (err) {
        // If the update fails because the 'where' condition isn't met, throw usage error
        if (err.code === 'P2025') {
            throw usageError('sms');
        }
        throw err;
    }
}

async function incrementAiUsage(clinicId, tx = prisma) {
    const { limit } = await assertWithinAiLimit(clinicId, tx);
    
    try {
        return await tx.clinic.update({
            where: { 
                id: clinicId,
                aiRequestCount: { lt: limit }
            },
            data: { aiRequestCount: { increment: 1 } },
        });
    } catch (err) {
        if (err.code === 'P2025') {
            throw usageError('ai');
        }
        throw err;
    }
}

module.exports = {
    DEFAULT_SMS_LIMIT,
    DEFAULT_AI_LIMIT,
    assertWithinSmsLimit,
    assertWithinAiLimit,
    incrementSmsUsage,
    incrementAiUsage,
    ensureMonthlyUsageWindow,
    DAILY_SMS_LIMIT,
};
