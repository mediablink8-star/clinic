const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { hashPassword } = require('./authService');
const { logAction } = require('./auditService');
const { applyClinicDefaults } = require('./clinicService');

// Admin-scoped: create a new clinic with owner user and defaults
async function createClinic({ name, ownerEmail, ownerPassword, ownerName }) {
    const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (existingUser) {
        throw new AppError('CONFLICT', 'A user with this email already exists', 409);
    }

    return await prisma.$transaction(async (tx) => {
        const clinic = await tx.clinic.create({
            data: {
                name,
                email: ownerEmail,
                phone: '',
                location: '',
                services: JSON.stringify([]),
                policies: JSON.stringify({}),
                workingHours: JSON.stringify({ weekdays: "09:00 - 18:00", saturday: "Closed" }),
            }
        });

        await applyClinicDefaults(clinic.id, tx);

        const passwordHash = await hashPassword(ownerPassword);
        const user = await tx.user.create({
            data: {
                email: ownerEmail,
                passwordHash,
                name: ownerName || name,
                role: 'OWNER',
                clinicId: clinic.id
            }
        });

        await logAction({
            clinicId: clinic.id,
            userId: user.id,
            action: 'CLINIC_CREATED',
            entity: 'CLINIC',
            entityId: clinic.id,
            ipAddress: 'system'
        });

        return { success: true, data: { clinic, user } };
    });
}

// Admin-scoped: add credits to a clinic
async function addCredits({ clinicId, amount }) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const updated = await prisma.clinic.update({
        where: { id: clinicId },
        data: {
            messageCredits: { increment: amount }
        }
    });

    return { success: true, data: { messageCredits: updated.messageCredits } };
}

// Admin-scoped: intentionally no clinicId filter — returns all clinics
async function getUsage() {
    const data = await prisma.clinic.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            location: true,
            messageCredits: true,
            monthlyCreditLimit: true,
            dailyUsedCount: true,
            dailyMessageCap: true,
            creditResetDate: true,
            isActive: true,
            plan: true,
            onboardingCompleted: true,
            createdAt: true,
            updatedAt: true,
            _count: {
                select: { users: true, patients: true, appointments: true }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });
    return { success: true, data };
}

// Admin-scoped: returns all message logs
async function getLogs() {
    const data = await prisma.messageLog.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
        include: { clinic: { select: { name: true } } }
    });
    return { success: true, data };
}

// Admin-scoped: returns all users with their clinics
async function getUsers() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isPlatformAdmin: true,
            lockedUntil: true,
            failedAttempts: true,
            mfaEnabled: true,
            createdAt: true,
            updatedAt: true,
            clinicId: true,
            clinic: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    isActive: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    // Add isActive: true in memory as users don't have isActive column in schema
    const data = users.map(u => ({ ...u, isActive: true }));
    return { success: true, data };
}

// Admin-scoped: update a user's role, lock status, or password
async function updateUser(userId, updates) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const data = {};

    if (updates.role !== undefined) {
        if (!['ADMIN', 'OWNER', 'DOCTOR', 'RECEPTIONIST', 'ASSISTANT'].includes(updates.role)) {
            throw new AppError('VALIDATION_ERROR', 'Invalid role', 400);
        }
        data.role = updates.role;
    }

    if (updates.isActive !== undefined) {
        data.isActive = updates.isActive;
    }

    if (updates.lockedUntil !== undefined) {
        data.lockedUntil = updates.lockedUntil;
        data.failedAttempts = 0;
    }

    if (updates.password) {
        data.passwordHash = await hashPassword(updates.password);
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data,
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isPlatformAdmin: true,
            isActive: true,
            lockedUntil: true,
            failedAttempts: true,
            clinicId: true
        }
    });

    return { success: true, data: updated };
}

// Admin-scoped: delete a user
async function deleteUser(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    // Don't allow deleting the last platform admin
    if (user.isPlatformAdmin) {
        const adminCount = await prisma.user.count({ where: { isPlatformAdmin: true } });
        if (adminCount <= 1) {
            throw new AppError('VALIDATION_ERROR', 'Cannot delete the last platform admin', 400);
        }
    }

    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
}

// Admin-scoped: get audit logs
async function getAuditLogs({ limit = 100, action, entity, startDate, endDate } = {}) {
     const where = {};

     if (action) where.action = action;
     if (entity) where.entity = entity;
     if (startDate || endDate) {
       where.createdAt = {};
       if (startDate) where.createdAt.gte = new Date(startDate);
       if (endDate) where.createdAt.lte = new Date(endDate);
     }

     const [logs, total] = await prisma.$transaction([
       prisma.auditLog.findMany({
         where,
         take: Math.min(limit, 500),
         orderBy: { createdAt: 'desc' },
         include: {
           clinic: { select: { name: true } }
         }
       }),
       prisma.auditLog.count({ where }),
     ]);

     // Fetch user info in memory since 'user' is not a relation in schema
     const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))];
     const users = await prisma.user.findMany({
       where: { id: { in: userIds } },
       select: { id: true, name: true, email: true }
     });
     const userMap = new Map(users.map(u => [u.id, u]));

     const data = logs.map(l => ({
       ...l,
       user: userMap.get(l.userId) || null
     }));

     return { success: true, data, total };
   }

// Admin-scoped: get platform-wide stats
async function getPlatformStats() {
    const [
        totalClinics,
        activeClinics,
        inactiveClinics,
        totalUsers,
        activeUsers,
        totalAppointments,
        totalMessages,
        totalPatients,
        totalAudits,
        allClinics,
        recentLogins,
        lowCreditClinics
    ] = await Promise.all([
        prisma.clinic.count(),
        prisma.clinic.count({ where: { isActive: true } }),
        prisma.clinic.count({ where: { isActive: false } }),
        prisma.user.count(),
        prisma.user.count(), // User doesn't have isActive column
        prisma.appointment.count(),
        prisma.messageLog.count(),
        prisma.patient.count(),
        prisma.auditLog.count(),
        prisma.clinic.findMany({
            select: { monthlyCreditLimit: true, dailyUsedCount: true }
        }),
        prisma.user.findMany({
            select: { id: true, email: true, name: true, createdAt: true, clinicId: true },
            orderBy: { createdAt: 'desc' },
            take: 10
        }),
        prisma.clinic.findMany({
            where: { messageCredits: { lte: 50 }, isActive: true },
            select: { id: true, name: true, messageCredits: true, monthlyCreditLimit: true, email: true }
        })
    ]);

    const totalCredits = allClinics.reduce((s, c) => s + (c.monthlyCreditLimit || 0), 0);
    const usedCredits = allClinics.reduce((s, c) => s + (c.dailyUsedCount || 0), 0);

    const peakHourData = await prisma.appointment.groupBy({
        by: ['startTime'],
        _count: { startTime: true },
        orderBy: { _count: { startTime: 'desc' } },
        take: 5
    });

    const recoveryStats = await prisma.missedCall.aggregate({
        _count: { _all: true },
        _sum: { estimatedRevenue: true },
        _avg: { estimatedRevenue: true }
    });

    // Proxy lastLoginAt to createdAt since User doesn't have lastLoginAt column
    const recentLoginsWithProxy = recentLogins.map(u => ({
        ...u,
        lastLoginAt: u.createdAt
    }));

    return {
        success: true,
        data: {
            summary: {
                totalClinics, activeClinics, inactiveClinics,
                totalUsers, activeUsers,
                totalAppointments, totalMessages, totalPatients, totalAudits,
                totalRevenue: recoveryStats._sum.estimatedRevenue || 0,
                avgRecoveryValue: Math.round(recoveryStats._avg.estimatedRevenue || 0),
                totalCredits,
                usedCredits
            },
            recentLogins: recentLoginsWithProxy,
            lowCreditClinics,
            peakHours: peakHourData.map(p => ({
                hour: new Date(p.startTime).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
                count: p._count.startTime
            }))
        }
    };
}

// Admin-scoped: get onboarding progress
async function getOnboardingProgress() {
    const clinics = await prisma.clinic.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            onboardingCompleted: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { users: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    });

    const completed = clinics.filter(c => c.onboardingCompleted).length;
    const pending = clinics.filter(c => !c.onboardingCompleted).length;

    return {
        success: true,
        data: {
            total: clinics.length,
            completed,
            pending,
            completionRate: clinics.length > 0 ? Math.round((completed / clinics.length) * 100) : 0,
            clinics
        }
    };
}

// Admin-scoped: bulk action on clinics
async function bulkUpdateClinics(clinicIds, action, value) {
    if (!clinicIds || clinicIds.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No clinics selected', 400);
    }

    let data = {};
    switch (action) {
        case 'activate':
            data = { isActive: true };
            break;
        case 'deactivate':
            data = { isActive: false };
            break;
        case 'reset_credits':
            data = { messageCredits: Number(value) || 100 };
            break;
        case 'reset_daily_cap':
            data = { dailyUsedCount: 0 };
            break;
        default:
            throw new AppError('VALIDATION_ERROR', `Unknown action: ${action}`, 400);
    }

    await prisma.clinic.updateMany({
        where: { id: { in: clinicIds } },
        data
    });

    return { success: true, updated: clinicIds.length };
}

module.exports = {
    getUsage,
    getLogs,
    addCredits,
    createClinic,
    getUsers,
    updateUser,
    deleteUser,
    getAuditLogs,
    getPlatformStats,
    getOnboardingProgress,
    bulkUpdateClinics
};