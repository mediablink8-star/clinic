const prisma = require('./prisma');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { ensureMonthlyUsageWindow } = require('./usageService');
const { encrypt, decrypt } = require('./encryptionService');
const { DEFAULT_PLAN, getPlanLimits } = require('./planService');
const config = require('../lib/config');
const { 
    DEFAULT_WORKING_HOURS, 
    DEFAULT_SERVICES, 
    DEFAULT_POLICIES, 
    DEFAULT_AI_CONFIG,
    INITIAL_CREDITS,
    INITIAL_MONTHLY_LIMIT,
    INITIAL_DAILY_CAP
} = require('../utils/defaults');
const logger = require('../utils/logger');

async function applyClinicDefaults(clinicId, tx = prisma) {
    const limits = getPlanLimits(DEFAULT_PLAN);

    return await tx.clinic.update({
        where: { id: clinicId },
        data: {
            workingHours: JSON.stringify(DEFAULT_WORKING_HOURS),
            services: JSON.stringify(DEFAULT_SERVICES),
            policies: JSON.stringify(DEFAULT_POLICIES),
            aiConfig: JSON.stringify(DEFAULT_AI_CONFIG),
            messageCredits: INITIAL_CREDITS,
            monthlyCreditLimit: INITIAL_MONTHLY_LIMIT,
            dailyMessageCap: limits.dailyMessageCap || INITIAL_DAILY_CAP,
            ...limits,
            onboardingCompleted: false,
        }
    });
}

async function resetClinicToDefaults(clinicId, actor) {
    const updated = await prisma.$transaction(async (tx) => {
        const result = await applyClinicDefaults(clinicId, tx);
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'RESET_CLINIC_DEFAULTS',
            entity: 'CLINIC',
            entityId: clinicId,
            ipAddress: actor.ip
        });
        return result;
    });
    return { success: true, data: formatClinicResponse(updated) };
}

function formatClinicResponse(clinic) {
    const safeJsonParse = (val, fallback) => {
        if (!val) return fallback;
        try { return JSON.parse(val); }
        catch (e) { logger.warn('ClinicService JSON parse failed', { error: e.message }); return fallback; }
    };
    const {
        webhookSecret,
        zadarmaApiKey,
        zadarmaApiSecret,
        geminiApiKey,
        googleCalendarRefreshToken,
        googleOAuthState,
        ...safeClinic
    } = clinic;

    const decryptSafe = (val) => {
        if (!val) return null;
        try {
            // Check if it looks like an encrypted string (iv:authTag:content)
            if (val.includes(':')) return decrypt(val);
            return val; // Fallback for legacy plaintext
        } catch (e) {
            logger.warn('ClinicService Decryption failed', { error: e.message });
            return val;
        }
    };

    return {
        ...safeClinic,
        workingHours: safeJsonParse(clinic.workingHours, {}),
        services: safeJsonParse(clinic.services, []),
        policies: safeJsonParse(clinic.policies, {}),
        aiConfig: safeJsonParse(clinic.aiConfig, null),
        hasWebhookSecret: Boolean(webhookSecret),
        hasZadarmaCredentials: Boolean(zadarmaApiKey),
        hasGeminiApiKey: Boolean(geminiApiKey),
        googleCalendarConnected: Boolean(googleCalendarRefreshToken),
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
    const smsMonthlyLimit = usage.smsMonthlyLimit || config.SMS_MONTHLY_LIMIT;
    const aiMonthlyLimit = usage.aiMonthlyLimit || config.AI_MONTHLY_LIMIT;
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

    // Encrypt sensitive fields if present
    const sensitiveFields = ['webhookSecret', 'zadarmaApiKey', 'zadarmaApiSecret', 'geminiApiKey', 'vapiAssistantId', 'vapiPhoneNumberId'];
    sensitiveFields.forEach(field => {
        if (updateData[field]) {
            updateData[field] = encrypt(updateData[field]);
        }
    });

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
            ...formatClinicResponse(updated)
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
    return { success: true, data: formatClinicResponse(updated) };
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
    return { success: true, data: formatClinicResponse(updated) };
}

module.exports = { 
    getClinic, 
    getClinicUsage, 
    updateClinicAdmin, 
    updateClinicInfo, 
    updateAiConfig, 
    updateClinicStatus,
    applyClinicDefaults,
    resetClinicToDefaults
};
