const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const { hashPassword } = require('../services/authService');
const { logAction } = require('../services/auditService');
const asyncHandler = require('../middleware/asyncHandler');

// Roles that can manage team (only OWNER and ADMIN)
const OWNER_ROLES = ['OWNER', 'ADMIN'];

/**
 * GET /api/team
 * List all users in the clinic
 */
router.get('/', asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
        where: { clinicId: req.clinicId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
            mfaEnabled: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 100
    });
    res.json(users);
}));

/**
 * POST /api/team
 * Invite (create) a new team member — OWNER only
 */
router.post('/', asyncHandler(async (req, res) => {
    if (!OWNER_ROLES.includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Μόνο ο ιδιοκτήτης μπορεί να προσθέσει μέλη.', 403);
    }

    const { email, name, role, password } = req.body;
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    if (!email || !trimmedPassword) {
        throw new AppError('VALIDATION_ERROR', 'Email και κωδικός είναι υποχρεωτικά.', 400);
    }

    if (trimmedPassword.length < 8) {
        throw new AppError('VALIDATION_ERROR', 'Password must be at least 8 characters.', 400);
    }

    const allowedRoles = ['OWNER', 'RECEPTIONIST', 'ASSISTANT'];
    if (!allowedRoles.includes(role)) {
        throw new AppError('VALIDATION_ERROR', 'Μη έγκυρος ρόλος.', 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new AppError('CONFLICT', 'Υπάρχει ήδη χρήστης με αυτό το email.', 409);
    }

    const passwordHash = await hashPassword(trimmedPassword);
    const user = await prisma.user.create({
        data: {
            email,
            name: name || '',
            passwordHash,
            role,
            clinicId: req.clinicId,
        },
        select: { id: true, email: true, name: true, role: true, createdAt: true }
    });

    await logAction({
        clinicId: req.clinicId,
        userId: req.user.userId,
        action: 'CREATE_TEAM_MEMBER',
        entity: 'USER',
        entityId: user.id,
        details: { email, role },
        ipAddress: req.ip
    });

    res.json(user);
}));

/**
 * PUT /api/team/:id
 * Update role of a team member — OWNER only
 */
router.put('/:id', asyncHandler(async (req, res) => {
    if (!OWNER_ROLES.includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Μόνο ο ιδιοκτήτης μπορεί να αλλάξει ρόλους.', 403);
    }

    const { role } = req.body;
    const allowedRoles = ['OWNER', 'RECEPTIONIST', 'ASSISTANT'];
    if (!allowedRoles.includes(role)) {
        throw new AppError('VALIDATION_ERROR', 'Μη έγκυρος ρόλος.', 400);
    }

    // Prevent demoting yourself
    if (req.params.id === req.user.userId) {
        throw new AppError('VALIDATION_ERROR', 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.', 400);
    }

    const target = await prisma.user.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId }
    });
    if (!target) throw new AppError('NOT_FOUND', 'Χρήστης δεν βρέθηκε.', 404);

    const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role },
        select: { id: true, email: true, name: true, role: true }
    });

    await logAction({
        clinicId: req.clinicId,
        userId: req.user.userId,
        action: 'UPDATE_TEAM_MEMBER_ROLE',
        entity: 'USER',
        entityId: req.params.id,
        details: { role },
        ipAddress: req.ip
    });

    res.json(updated);
}));

/**
 * DELETE /api/team/:id
 * Remove a team member — OWNER only
 */
router.delete('/:id', asyncHandler(async (req, res) => {
    if (!OWNER_ROLES.includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Μόνο ο ιδιοκτήτης μπορεί να αφαιρέσει μέλη.', 403);
    }

    if (req.params.id === req.user.userId) {
        throw new AppError('VALIDATION_ERROR', 'Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.', 400);
    }

    const target = await prisma.user.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId }
    });
    if (!target) throw new AppError('NOT_FOUND', 'Χρήστης δεν βρέθηκε.', 404);

    // Delete refresh tokens first (FK constraint)
    await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });
    await prisma.user.delete({ where: { id: req.params.id } });

    await logAction({
        clinicId: req.clinicId,
        userId: req.user.userId,
        action: 'DELETE_TEAM_MEMBER',
        entity: 'USER',
        entityId: req.params.id,
        details: { email: target.email },
        ipAddress: req.ip
    });

    res.json({ success: true });
}));

module.exports = router;
