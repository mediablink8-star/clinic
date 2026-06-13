const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');
const {
    getAuthUrl,
    handleCallback,
    disconnect,
} = require('../services/googleCalendarService');

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        throw new AppError('FORBIDDEN', 'Απαιτείται ρόλος Ιδιοκτήτη.', 403);
    }
    next();
};

/**
 * GET /api/clinic/google-calendar/status
 * Returns whether Google Calendar is connected for this clinic.
 */
router.get('/status', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.clinicId },
        select: { googleCalendarEnabled: true, googleCalendarId: true }
    });
    res.json({
        connected: clinic?.googleCalendarEnabled || false,
        calendarId: clinic?.googleCalendarId || null,
    });
}));

/**
 * GET /api/clinic/google-calendar/auth
 * Returns the Google OAuth2 authorization URL.
 */
router.get('/auth', requireOwner, asyncHandler(async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        throw new AppError('SERVICE_UNAVAILABLE', 'Google Calendar integration not configured on this server.', 503);
    }
    const url = await getAuthUrl(req.clinicId);
    res.json({ url });
}));

module.exports = router;
