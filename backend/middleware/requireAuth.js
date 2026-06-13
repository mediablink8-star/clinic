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

        req.user = decoded;
        req.clinicId = decoded.clinicId;

        const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
        if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
        if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);

        req.clinic = clinic;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = { requireAuth };
