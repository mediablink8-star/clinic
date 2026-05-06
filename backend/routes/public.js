const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getPublicClinic, getAvailableSlots, bookAppointment } = require('../services/publicService');
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
const bookingLimiterMap = new Map();
let accessOrder = [];

function getBookingLimiter(clinicId) {
    if (!bookingLimiterMap.has(clinicId)) {
        if (bookingLimiterMap.size >= MAX_LIMITER_CACHE && accessOrder.length > 0) {
            const oldest = accessOrder.shift();
            bookingLimiterMap.delete(oldest);
        }
        bookingLimiterMap.set(clinicId, rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            message: { error: 'Too many booking attempts for this clinic. Please try again later.' }
        }));
        accessOrder.push(clinicId);
    }
    return bookingLimiterMap.get(clinicId);
}

router.use(publicLimiter);

router.get('/clinic/:id', clinicEnumerationLimiter, asyncHandler(async (req, res) => {
    const { data } = await getPublicClinic(req.params.id);
    res.json(data);
}));

router.get('/clinic/:id/slots', clinicEnumerationLimiter, asyncHandler(async (req, res) => {
    const { date } = req.query;
    const slots = await getAvailableSlots(req.params.id, date);
    res.json({ success: true, data: slots });
}));

router.post('/book', validate(publicBookingSchema), asyncHandler(async (req, res) => {
    const { clinicId, name, phone, email, reason, startTime } = req.body;
    // Apply per-clinic rate limit dynamically
    if (clinicId) {
        await new Promise((resolve, reject) => {
            getBookingLimiter(clinicId)(req, res, (err) => err ? reject(err) : resolve());
        });
    }
    const { data } = await bookAppointment({ clinicId, name, phone, email, reason, startTime });
    res.json({ success: true, ...data });
}));

module.exports = router;
