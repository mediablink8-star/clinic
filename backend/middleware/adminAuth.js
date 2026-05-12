const { verifyToken } = require('../services/authService');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');
const asyncHandler = require('./asyncHandler');

const requirePlatformAdmin = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
        throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    // Check if user is platform admin in DB for security (don't rely solely on JWT)
    const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { isPlatformAdmin: true }
    });

    if (!user || !user.isPlatformAdmin) {
        throw new AppError('FORBIDDEN', 'Access denied: Platform Admin privileges required', 403);
    }

    req.user = { ...decoded, isPlatformAdmin: user.isPlatformAdmin };
    next();
});

module.exports = { requirePlatformAdmin };
