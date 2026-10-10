/**
 * Authentication middleware.
 *
 * Verifies the JWT in the Authorization header, loads the associated clinic,
 * and attaches { user, clinic, clinicId } to the request. Also enforces that
 * the clinic account is active (i.e. owner hasn't disabled it manually).
 */

const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');
const { verifyToken } = require('../services/authService');

const requireAuth = async (req, _res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (!decoded || !decoded.userId) {
            throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
        }

        if (typeof decoded.clinicId !== 'string' || !decoded.clinicId) {
            throw new AppError('UNAUTHORIZED', 'Token is not associated with a clinic', 401);
        }

        // Resolve the current user record on every authenticated request. This
        // makes removed users and role changes take effect immediately instead
        // of leaving old access tokens usable until they expire.
        const [user, clinic] = await Promise.all([
            prisma.user.findUnique({
                where: { id: decoded.userId },
                select: { id: true, clinicId: true, role: true }
            }),
            prisma.clinic.findUnique({ where: { id: decoded.clinicId } })
        ]);

        if (!user || user.clinicId !== decoded.clinicId) {
            throw new AppError('UNAUTHORIZED', 'User is no longer a member of this clinic', 401);
        }
        if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
        if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);

        // Never trust a role claim from a token after the database role changes.
        req.user = { ...decoded, role: user.role };
        req.clinicId = user.clinicId;
        req.clinic = clinic;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { requireAuth };
