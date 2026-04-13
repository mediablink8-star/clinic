const prisma = require('./prisma');
const AppError = require('../errors/AppError');

const DEFAULT_SMS_LIMIT = Number(process.env.SMS_MONTHLY_LIMIT || 500);
const DEFAULT_AI_LIMIT = Number(process.env.AI_MONTHLY_LIMIT || 1000);
const SPIKE_SMS_THRESHOLD = Number(process.env.SMS_SPIKE_THRESHOLD || 450);
const SPIKE_AI_THRESHOLD = Number(process.env.AI_SPIKE_THRESHOLD || 900);

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
    const limit = clinic.smsMonthlyLimit || DEFAULT_SMS_LIMIT;
    if (clinic.smsCount >= limit) {
        throw new AppError('USAGE_LIMIT_REACHED', 'Usage limit reached', 429);
    }
    if (clinic.smsCount >= SPIKE_SMS_THRESHOLD) {
        console.warn(`[USAGE_SPIKE] clinic=${clinicId} smsCount=${clinic.smsCount} limit=${limit}`);
    }
    return clinic;
}

async function assertWithinAiLimit(clinicId) {
    const clinic = await ensureMonthlyUsageWindow(clinicId);
    const limit = clinic.aiMonthlyLimit || DEFAULT_AI_LIMIT;
    if (clinic.aiRequestCount >= limit) {
        throw new AppError('USAGE_LIMIT_REACHED', 'Usage limit reached', 429);
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
};
