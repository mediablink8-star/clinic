const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
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
        orderBy: { createdAt: 'asc' }
    });
    res.json(users);
}));

/**
 * POST /api/team
 * Invite (create) a new team member — OWNER only
 */
router.post('/', asyncHandler(async (req, res) => {
    if (!OWNER_ROLES.includes(req.user.role)) {
        return res.status(403).json({ error: 'Μόνο ο ιδιοκτήτης μπορεί να προσθέσει μέλη.' });
    }

    const { email, name, role, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email και κωδικός είναι υποχρεωτικά.' });
    }

    const allowedRoles = ['OWNER', 'RECEPTIONIST', 'ASSISTANT'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Μη έγκυρος ρόλος.' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        return res.status(409).json({ error: 'Υπάρχει ήδη χρήστης με αυτό το email.' });
    }

    const passwordHash = await hashPassword(password);
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
        return res.status(403).json({ error: 'Μόνο ο ιδιοκτήτης μπορεί να αλλάξει ρόλους.' });
    }

    const { role } = req.body;
    const allowedRoles = ['OWNER', 'RECEPTIONIST', 'ASSISTANT'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: 'Μη έγκυρος ρόλος.' });
    }

    // Prevent demoting yourself
    if (req.params.id === req.user.userId) {
        return res.status(400).json({ error: 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο.' });
    }

    const target = await prisma.user.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId }
    });
    if (!target) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε.' });

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
        return res.status(403).json({ error: 'Μόνο ο ιδιοκτήτης μπορεί να αφαιρέσει μέλη.' });
    }

    if (req.params.id === req.user.userId) {
        return res.status(400).json({ error: 'Δεν μπορείτε να αφαιρέσετε τον εαυτό σας.' });
    }

    const target = await prisma.user.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId }
    });
    if (!target) return res.status(404).json({ error: 'Χρήστης δεν βρέθηκε.' });

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
