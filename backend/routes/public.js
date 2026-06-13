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

router.post('/book', validate(publicBookingSchema), asyncHandler(async (req, res) => {
    const { clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId } = req.body;
    // Apply per-clinic rate limit dynamically
    if (clinicId) {
        await new Promise((resolve, reject) => {
            getBookingLimiter(clinicId)(req, res, (err) => err ? reject(err) : resolve());
        });
    }
    const result = await bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId });
    res.json(result);
}));

module.exports = router;
