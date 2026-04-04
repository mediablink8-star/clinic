const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getPublicClinic, getAvailableSlots, bookAppointment } = require('../services/publicService');

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
    const { data } = await bookAppointment({ clinicId, name, phone, email, reason, startTime });
    res.json({ success: true, ...data });
}));

module.exports = router;
