const prisma = require('./prisma');
const { encrypt, decrypt } = require('./encryptionService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');

function maskApiKeys(apiKeys) {
    const masked = {};
    Object.keys(apiKeys).forEach(key => {
        try {
            const decrypted = decrypt(apiKeys[key]);
            masked[key] = decrypted ? `********${decrypted.slice(-4)}` : '********';
        } catch {
            masked[key] = '********';
        }
    });
    return masked;
}

function formatClinicResponse(clinic) {
    const apiKeys = JSON.parse(clinic.apiKeys || '{}');
    let maskedWebhookSecret = clinic.webhookSecret;
    if (clinic.webhookSecret) {
        try {
            const dec = decrypt(clinic.webhookSecret);
            maskedWebhookSecret = dec ? `********${dec.slice(-4)}` : '********';
        } catch {
            maskedWebhookSecret = '********';
        }
    }
    return {
        ...clinic,
        workingHours: JSON.parse(clinic.workingHours),
        services: JSON.parse(clinic.services),
        policies: JSON.parse(clinic.policies),
        webhookSecret: maskedWebhookSecret,
        aiConfig: clinic.aiConfig ? JSON.parse(clinic.aiConfig) : null,
        apiKeys: maskApiKeys(apiKeys)
    };
}

async function getClinic(clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    return { success: true, data: formatClinicResponse(clinic) };
}

async function getClinicUsage(clinicId) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { messageCredits: true, monthlyCreditLimit: true, dailyUsedCount: true, dailyMessageCap: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const aiRequestsToday = await prisma.auditLog.count({
        where: { clinicId, action: 'AI_REQUEST', createdAt: { gte: todayStart } }
    });

    return {
        success: true,
        data: {
            creditsRemaining: clinic.messageCredits,
            monthlyLimit: clinic.monthlyCreditLimit,
            dailyUsed: clinic.dailyUsedCount,
            dailyLimit: clinic.dailyMessageCap,
            aiRequestsToday
        }
    };
}

async function updateClinicAdmin({ clinicId, body, currentClinic }, actor) {
    const updateData = { ...body };

    if (updateData.workingHours && typeof updateData.workingHours === 'object')
        updateData.workingHours = JSON.stringify(updateData.workingHours);
    if (updateData.services && typeof updateData.services === 'object')
        updateData.services = JSON.stringify(updateData.services);
    if (updateData.policies && typeof updateData.policies === 'object')
        updateData.policies = JSON.stringify(updateData.policies);

    if (updateData.apiKeys && typeof updateData.apiKeys === 'object') {
        const currentKeys = JSON.parse(currentClinic.apiKeys || '{}');
        const newKeys = { ...currentKeys };
        Object.keys(updateData.apiKeys).forEach(key => {
            const value = updateData.apiKeys[key];
            if (value && value !== '********') newKeys[key] = encrypt(value);
        });
        updateData.apiKeys = JSON.stringify(newKeys);
    }

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

    const finalKeys = JSON.parse(updated.apiKeys || '{}');
    const maskedFinalKeys = {};
    Object.keys(finalKeys).forEach(k => { maskedFinalKeys[k] = '********'; });

    return {
        success: true,
        data: {
            ...updated,
            workingHours: JSON.parse(updated.workingHours),
            services: JSON.parse(updated.services),
            policies: JSON.parse(updated.policies),
            aiConfig: updated.aiConfig ? JSON.parse(updated.aiConfig) : null,
            apiKeys: maskedFinalKeys
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

module.exports = { getClinic, getClinicUsage, updateClinicAdmin, updateClinicInfo, updateAiConfig };
