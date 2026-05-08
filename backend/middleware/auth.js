const { verifyToken } = require('../services/authService');
const asyncHandler = require('./asyncHandler');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');

const requireAuth = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
        throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    req.user = decoded; // { userId, clinicId, role }
    req.clinicId = decoded.clinicId;

    // Check clinic is active
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);
    req.clinic = clinic;

    next();
});

const ROLE_HIERARCHY = ['ASSISTANT', 'RECEPTIONIST', 'ADMIN', 'OWNER'];

const requireRole = (role) => {
    return (req, res, next) => {
        const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user?.role);
        const requiredRoleIndex = ROLE_HIERARCHY.indexOf(role);
        if (userRoleIndex < requiredRoleIndex) {
            throw new AppError('FORBIDDEN', 'Forbidden: Insufficient permissions', 403);
        }
        next();
    };
};

module.exports = { requireAuth, requireRole };
