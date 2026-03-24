const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { getPublicClinic, bookAppointment } = require('../services/publicService');

router.get('/clinic/:id', asyncHandler(async (req, res) => {
    const { data } = await getPublicClinic(req.params.id);
    res.json(data);
}));

router.post('/book', asyncHandler(async (req, res) => {
    const { clinicId, name, phone, email, reason, startTime } = req.body;
    const { data } = await bookAppointment({ clinicId, name, phone, email, reason, startTime });
    res.json({ success: true, ...data });
}));

module.exports = router;
