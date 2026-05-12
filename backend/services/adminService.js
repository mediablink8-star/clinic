const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { hashPassword } = require('./authService');

// Admin-scoped: intentionally no clinicId filter — returns all clinics
async function getUsage() {
    const data = await prisma.clinic.findMany({
        select: { 
            id: true, 
            name: true, 
            messageCredits: true, 
            monthlyCreditLimit: true, 
            dailyUsedCount: true, 
            dailyMessageCap: true, 
            creditResetDate: true,
            isActive: true,
            createdAt: true,
            _count: {
                select: { users: true, patients: true, appointments: true }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    return { success: true, data };
}

// Admin-scoped: intentionally no clinicId filter — returns all logs
async function getLogs() {
    const data = await prisma.messageLog.findMany({
        take: 100,
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

async function createClinic({ name, ownerEmail, ownerPassword, ownerName }) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser) {
        throw new AppError('CONFLICT', 'User with this email already exists', 409);
    }

    const passwordHash = await hashPassword(ownerPassword);

    const result = await prisma.$transaction(async (tx) => {
        // 1. Create Clinic
        const clinic = await tx.clinic.create({
            data: {
                name,
                email: ownerEmail,
                phone: '',
                location: '',
                services: JSON.stringify([
                    { id: '1', name: 'General Consultation', duration: 30, price: 50 },
                    { id: '2', name: 'Follow-up Visit', duration: 15, price: 30 }
                ]),
                policies: JSON.stringify({
                    cancellationNotice: 24,
                    reminderHours: 24
                }),
                workingHours: JSON.stringify({
                    weekdays: { start: "09:00", end: "18:00", active: true },
                    saturday: { start: "10:00", end: "14:00", active: true },
                    sunday: { active: false }
                }),
                messageCredits: 100,
                dailyMessageCap: 50,
                aiConfig: JSON.stringify({
                    tone: 'professional',
                    language: 'el',
                    autoReplyEnabled: true
                })
            }
        });

        // 2. Create Owner User
        const user = await tx.user.create({
            data: {
                email: ownerEmail,
                passwordHash,
                role: 'OWNER',
                clinicId: clinic.id,
                name: ownerName || name
            }
        });

        return { clinic, user };
    });

    return { success: true, data: result };
}

module.exports = { getUsage, getLogs, addCredits, createClinic };
