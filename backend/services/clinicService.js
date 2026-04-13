const prisma = require('./prisma');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { ensureMonthlyUsageWindow, DEFAULT_SMS_LIMIT, DEFAULT_AI_LIMIT } = require('./usageService');

function formatClinicResponse(clinic) {
    return {
        ...clinic,
        workingHours: JSON.parse(clinic.workingHours),
        services: JSON.parse(clinic.services),
        policies: JSON.parse(clinic.policies),
        aiConfig: clinic.aiConfig ? JSON.parse(clinic.aiConfig) : null
    };
}

async function getClinic(clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    return { success: true, data: formatClinicResponse(clinic) };
}

async function getClinicUsage(clinicId) {
    await ensureMonthlyUsageWindow(clinicId);
    const usage = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            messageCredits: true, monthlyCreditLimit: true, dailyUsedCount: true, dailyMessageCap: true,
            smsCount: true, aiRequestCount: true, lastResetDate: true, smsMonthlyLimit: true, aiMonthlyLimit: true
        }
    });
    if (!usage) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    const smsMonthlyLimit = usage.smsMonthlyLimit || DEFAULT_SMS_LIMIT;
    const aiMonthlyLimit = usage.aiMonthlyLimit || DEFAULT_AI_LIMIT;
    const smsUsagePercent = Math.min(100, Math.round((usage.smsCount / Math.max(1, smsMonthlyLimit)) * 100));
    const aiUsagePercent = Math.min(100, Math.round((usage.aiRequestCount / Math.max(1, aiMonthlyLimit)) * 100));
    const usageWarnings = [];
    if (smsUsagePercent >= 80) usageWarnings.push({ type: 'sms', percent: smsUsagePercent, message: 'SMS usage above 80%' });
    if (aiUsagePercent >= 80) usageWarnings.push({ type: 'ai', percent: aiUsagePercent, message: 'AI usage above 80%' });

    return {
        success: true,
        data: {
            creditsRemaining: usage.messageCredits,
            monthlyLimit: usage.monthlyCreditLimit,
            dailyUsed: usage.dailyUsedCount,
            dailyLimit: usage.dailyMessageCap,
            aiRequestsToday: usage.aiRequestCount,
            smsCount: usage.smsCount,
            aiRequestCount: usage.aiRequestCount,
            lastResetDate: usage.lastResetDate,
            smsMonthlyLimit,
            aiMonthlyLimit,
            smsUsagePercent,
            aiUsagePercent,
            usageWarnings,
            limitsReached: {
                sms: usage.smsCount >= smsMonthlyLimit,
                ai: usage.aiRequestCount >= aiMonthlyLimit
            },
            planLabel: 'Included in your plan'
        }
    };
}

async function updateClinicAdmin({ clinicId, body, currentClinic: _currentClinic }, actor) {
    const updateData = { ...body };

    if (updateData.workingHours && typeof updateData.workingHours === 'object')
        updateData.workingHours = JSON.stringify(updateData.workingHours);
    if (updateData.services && typeof updateData.services === 'object')
        updateData.services = JSON.stringify(updateData.services);
    if (updateData.policies && typeof updateData.policies === 'object')
        updateData.policies = JSON.stringify(updateData.policies);

    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.clinic.update({ where: { id: clinicId }, data: updateData });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'UPDATE_CLINIC_SETTINGS',
            entity: 'CLINIC',
            entityId: clinicId,
            details: body,
            ipAddress: actor.ip
        });
        return result;
    });

    return {
        success: true,
        data: {
            ...updated,
            workingHours: JSON.parse(updated.workingHours),
            services: JSON.parse(updated.services),
            policies: JSON.parse(updated.policies),
            aiConfig: updated.aiConfig ? JSON.parse(updated.aiConfig) : null
        }
    };
}

async function updateClinicInfo({ clinicId, name, phone, email, location, timezone }, actor) {
    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.clinic.update({
            where: { id: clinicId },
            data: { name, phone, email, location, timezone }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'UPDATE_CLINIC_INFO',
            entity: 'CLINIC',
            entityId: clinicId,
            details: { name, phone, email, location, timezone },
            ipAddress: actor.ip
        });
        return result;
    });
    return { success: true, data: updated };
}

async function updateAiConfig({ clinicId, aiConfig }, actor) {
    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.clinic.update({
            where: { id: clinicId },
            data: { aiConfig: JSON.stringify(aiConfig) }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'UPDATE_AI_CONFIG',
            entity: 'CLINIC',
            entityId: clinicId,
            details: aiConfig,
            ipAddress: actor.ip
        });
        return result;
    });
    return { success: true, data: JSON.parse(updated.aiConfig) };
}

async function updateClinicStatus({ clinicId, isActive }, actor) {
    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.clinic.update({
            where: { id: clinicId },
            data: { isActive }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: isActive ? 'CLINIC_ACTIVATE' : 'CLINIC_DEACTIVATE',
            entity: 'CLINIC',
            entityId: clinicId,
            details: { isActive },
            ipAddress: actor.ip
        });
        return result;
    });
    return { success: true, data: updated };
}

module.exports = { getClinic, getClinicUsage, updateClinicAdmin, updateClinicInfo, updateAiConfig, updateClinicStatus };
