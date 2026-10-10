const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const { getPublicClinic, listPublicDoctors, getAvailableSlots, bookAppointment } = require('../services/publicService');
const { validate, publicBookingSchema } = require('../services/validationService');

const rateLimit = require('express-rate-limit');
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
});

// Strict limiter for clinic enumeration prevention
const clinicEnumerationLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many clinic lookups, please try again later' }
});

// Per-clinic booking limiter: 10 bookings per hour per IP per clinic
const MAX_LIMITER_CACHE = 100;
// Map preserves insertion order; re-inserting on access gives true LRU eviction
const bookingLimiterMap = new Map();

function getBookingLimiter(clinicId) {
    if (bookingLimiterMap.has(clinicId)) {
        // Move to end (most-recently-used) by re-inserting
        const limiter = bookingLimiterMap.get(clinicId);
        bookingLimiterMap.delete(clinicId);
        bookingLimiterMap.set(clinicId, limiter);
        return limiter;
    }
    if (bookingLimiterMap.size >= MAX_LIMITER_CACHE) {
        // First key is least-recently-used
        const lruKey = bookingLimiterMap.keys().next().value;
        bookingLimiterMap.delete(lruKey);
    }
    const limiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 10,
        message: { error: 'Too many booking attempts for this clinic. Please try again later.' }
    });
    bookingLimiterMap.set(clinicId, limiter);
    return limiter;
}

router.use(publicLimiter);

router.get('/clinic/:id', clinicEnumerationLimiter, asyncHandler(async (req, res) => {
    const { data } = await getPublicClinic(req.params.id);
    res.json({ success: true, data });
}));

router.get('/clinic/:id/doctors', clinicEnumerationLimiter, asyncHandler(async (req, res) => {
    const { data } = await listPublicDoctors(req.params.id);
    res.json({ success: true, data });
}));

router.get('/clinic/:id/slots', clinicEnumerationLimiter, asyncHandler(async (req, res) => {
    const { date, doctorId } = req.query;
    const { data: slots } = await getAvailableSlots(req.params.id, date, doctorId);
    res.json({ success: true, data: slots });
}));

async function verifyBookingRecaptcha(token) {
    const secret = (process.env.RECAPTCHA_SECRET_KEY || '').trim();
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError('RECAPTCHA_NOT_CONFIGURED', 'Booking security verification is not configured', 503);
        }
        return; // Local/test environments may run without external CAPTCHA credentials.
    }
    if (typeof token !== 'string' || !token.trim()) {
        throw new AppError('RECAPTCHA_REQUIRED', 'Please complete the security verification', 400);
    }

    let result;
    try {
        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ secret, response: token }),
            signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) throw new Error(`reCAPTCHA returned HTTP ${response.status}`);
        result = await response.json();
    } catch (error) {
        throw new AppError('RECAPTCHA_UNAVAILABLE', 'Security verification is temporarily unavailable', 503);
    }

    const thresholdValue = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
    const minimumScore = Number.isFinite(thresholdValue) ? Math.min(1, Math.max(0, thresholdValue)) : 0.5;
    const allowedHostnames = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || '')
        .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    if (process.env.NODE_ENV === 'production' && allowedHostnames.length === 0) {
        throw new AppError('RECAPTCHA_NOT_CONFIGURED', 'Allowed reCAPTCHA hostnames are not configured', 503);
    }
    const hostname = typeof result.hostname === 'string' ? result.hostname.toLowerCase() : '';
    if (!result.success || result.action !== 'booking_submit' ||
        typeof result.score !== 'number' || result.score < minimumScore ||
        (allowedHostnames.length > 0 && !allowedHostnames.includes(hostname))) {
        throw new AppError('RECAPTCHA_FAILED', 'Security verification failed. Please try again.', 400);
    }
}

router.post('/book', validate(publicBookingSchema), asyncHandler(async (req, res) => {
    const { clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId, recaptchaToken } = req.body;
    // Rate-limit before making the external CAPTCHA verification request.
    if (clinicId) {
        await new Promise((resolve, reject) => {
            getBookingLimiter(clinicId)(req, res, (err) => err ? reject(err) : resolve());
        });
    }
    await verifyBookingRecaptcha(recaptchaToken);
    const result = await bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId });
    res.json(result);
}));

module.exports = router;
