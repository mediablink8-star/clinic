const { PrismaClient } = require('@prisma/client');
const AppError = require('../errors/AppError');

const prisma = new PrismaClient();

// Admin-scoped: intentionally no clinicId filter — returns all clinics
async function getUsage() {
    const data = await prisma.clinic.findMany({
        select: { id: true, name: true, messageCredits: true, monthlyCreditLimit: true, dailyUsedCount: true, dailyMessageCap: true, creditResetDate: true }
    });
    return { success: true, data };
}

// Admin-scoped: intentionally no clinicId filter — returns all logs
async function getLogs() {
    const data = await prisma.messageLog.findMany({
        take: 50,
        orderBy: { timestamp: 'desc' },
        include: { clinic: { select: { name: true } } }
    });
    return { success: true, data };
}

async function addCredits({ clinicId, amount }) {
    if (!clinicId) throw new AppError('VALIDATION_ERROR', 'clinicId is required', 400);

    const parsed = parseInt(amount);
    if (isNaN(parsed) || parsed <= 0) {
        throw new AppError('VALIDATION_ERROR', 'amount must be a positive integer', 400);
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const updated = await prisma.clinic.update({
        where: { id: clinicId },
        data: { messageCredits: { increment: parsed } }
    });

    return { success: true, data: { newBalance: updated.messageCredits } };
}

module.exports = { getUsage, getLogs, addCredits };
