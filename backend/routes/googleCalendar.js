const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../services/prisma');
const {
    getAuthUrl,
    handleCallback,
    disconnect,
} = require('../services/googleCalendarService');

const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
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
        return res.status(503).json({ error: 'Google Calendar integration not configured on this server.' });
    }
    const url = getAuthUrl(req.clinicId);
    res.json({ url });
}));

/**
 * GET /api/clinic/google-calendar/callback
 * OAuth2 callback — exchanges code for tokens and saves them.
 * Redirects to frontend settings page when done.
 */
router.get('/callback', asyncHandler(async (req, res) => {
    const { code, state: clinicId, error } = req.query;

    const frontendUrl = process.env.FRONTEND_URL || 'https://clinicflows.vercel.app';

    if (error) {
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=${encodeURIComponent(error)}`);
    }

    if (!code || !clinicId) {
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=missing_params`);
    }

    try {
        await handleCallback(code, clinicId);
        res.redirect(`${frontendUrl}/settings?gcal=connected`);
    } catch (err) {
        console.error('[GoogleCalendar] Callback error:', err.message);
        res.redirect(`${frontendUrl}/settings?gcal=error&reason=${encodeURIComponent(err.message)}`);
    }
}));

/**
 * DELETE /api/clinic/google-calendar/disconnect
 * Removes Google Calendar connection for this clinic.
 */
router.delete('/disconnect', requireOwner, asyncHandler(async (req, res) => {
    await disconnect(req.clinicId);
    res.json({ success: true });
}));

module.exports = router;
