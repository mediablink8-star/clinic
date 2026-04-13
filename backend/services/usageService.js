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

function pushAndTrim(map, clinicId, windowMs) {
    const now = nowMs();
    const history = map.get(clinicId) || [];
    const next = history.filter((t) => now - t <= windowMs);
    next.push(now);
    map.set(clinicId, next);
    return next;
}

function assertNotTemporarilyBlocked(clinicId, type) {
    const blockedUntil = inMemoryRate.blockedUntil.get(`${type}:${clinicId}`) || 0;
    if (blockedUntil > nowMs()) {
        throw usageError(type);
    }
}

function triggerTemporaryBlock(clinicId, type, reason) {
    const until = nowMs() + TEMP_BLOCK_MS;
    inMemoryRate.blockedUntil.set(`${type}:${clinicId}`, until);
    console.warn(`[SPIKE_BLOCK] clinic=${clinicId} type=${type} until=${new Date(until).toISOString()} reason=${reason}`);
}

function assertRateLimits(clinicId, type) {
    const bucket = inMemoryRate[type];
    const minuteSamples = pushAndTrim(bucket, clinicId, RATE_WINDOW_MS);
    const minuteLimit = type === 'ai' ? AI_PER_MINUTE_LIMIT : SMS_PER_MINUTE_LIMIT;
    if (minuteSamples.length > minuteLimit) {
        triggerTemporaryBlock(clinicId, type, 'minute_rate_exceeded');
        throw rateError(type);
    }
    if (type === 'sms') {
        const burst = minuteSamples.filter((t) => nowMs() - t <= BURST_WINDOW_MS);
        if (burst.length > SMS_BURST_LIMIT) {
            triggerTemporaryBlock(clinicId, type, 'burst_exceeded');
            throw rateError(type);
        }
    }
}

function startOfCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

function shouldResetUsage(lastResetDate) {
    if (!lastResetDate) return true;
    const resetDate = new Date(lastResetDate);
    const monthStart = startOfCurrentMonth();
    return resetDate < monthStart;
}

async function ensureMonthlyUsageWindow(clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    if (!shouldResetUsage(clinic.lastResetDate)) {
        return clinic;
    }

    return prisma.clinic.update({
        where: { id: clinicId },
        data: {
            smsCount: 0,
            aiRequestCount: 0,
            lastResetDate: startOfCurrentMonth(),
        },
    });
}

async function assertWithinSmsLimit(clinicId) {
    const clinic = await ensureMonthlyUsageWindow(clinicId);
    assertNotTemporarilyBlocked(clinicId, 'sms');
    assertRateLimits(clinicId, 'sms');
    const limit = clinic.smsMonthlyLimit || DEFAULT_SMS_LIMIT;
    const dailyLimit = Math.min(clinic.dailyMessageCap || DAILY_SMS_LIMIT, DAILY_SMS_LIMIT);
    if (clinic.smsCount >= limit) {
        throw usageError('sms');
    }
    if ((clinic.dailyUsedCount || 0) >= dailyLimit) {
        throw usageError('sms');
    }
    const usagePct = (clinic.smsCount / Math.max(1, limit)) * 100;
    if (usagePct >= 80) {
        console.warn(`[USAGE_WARNING] clinic=${clinicId} type=sms pct=${Math.round(usagePct)}`);
    }
    if (clinic.smsCount >= SPIKE_SMS_THRESHOLD || (clinic.dailyUsedCount || 0) >= Math.floor(dailyLimit * 0.9)) {
        console.warn(`[USAGE_SPIKE] clinic=${clinicId} smsCount=${clinic.smsCount} limit=${limit}`);
    }
    return clinic;
}

async function assertWithinAiLimit(clinicId) {
    const clinic = await ensureMonthlyUsageWindow(clinicId);
    assertNotTemporarilyBlocked(clinicId, 'ai');
    assertRateLimits(clinicId, 'ai');
    const limit = clinic.aiMonthlyLimit || DEFAULT_AI_LIMIT;
    if (clinic.aiRequestCount >= limit) {
        throw usageError('ai');
    }
    const usagePct = (clinic.aiRequestCount / Math.max(1, limit)) * 100;
    if (usagePct >= 80) {
        console.warn(`[USAGE_WARNING] clinic=${clinicId} type=ai pct=${Math.round(usagePct)}`);
    }
    if (clinic.aiRequestCount >= SPIKE_AI_THRESHOLD) {
        console.warn(`[USAGE_SPIKE] clinic=${clinicId} aiRequestCount=${clinic.aiRequestCount} limit=${limit}`);
    }
    return clinic;
}

async function incrementSmsUsage(clinicId, tx = null) {
    const client = tx || prisma;
    return client.clinic.update({
        where: { id: clinicId },
        data: { smsCount: { increment: 1 } },
    });
}

async function incrementAiUsage(clinicId) {
    return prisma.clinic.update({
        where: { id: clinicId },
        data: { aiRequestCount: { increment: 1 } },
    });
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
