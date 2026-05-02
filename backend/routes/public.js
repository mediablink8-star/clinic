const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getPublicClinic, getAvailableSlots, bookAppointment } = require('../services/publicService');

const rateLimit = require('express-rate-limit');
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' }
});

// Per-clinic booking limiter: 10 bookings per hour per IP per clinic
const bookingLimiterMap = new Map();
function getBookingLimiter(clinicId) {
    if (!bookingLimiterMap.has(clinicId)) {
        bookingLimiterMap.set(clinicId, rateLimit({
            windowMs: 60 * 60 * 1000,
            max: 10,
            keyGenerator: (req) => `${req.ip}:${clinicId}`,
            message: { error: 'Too many booking attempts for this clinic. Please try again later.' }
        }));
    }
    return bookingLimiterMap.get(clinicId);
}

router.use(publicLimiter);

router.get('/clinic/:id', asyncHandler(async (req, res) => {
    const { data } = await getPublicClinic(req.params.id);
    res.json(data);
}));

router.get('/clinic/:id/slots', asyncHandler(async (req, res) => {
    const { date } = req.query;
    const slots = await getAvailableSlots(req.params.id, date);
    res.json({ success: true, data: slots });
}));

router.post('/book', asyncHandler(async (req, res) => {
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
