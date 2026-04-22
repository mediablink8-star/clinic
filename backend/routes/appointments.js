const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { validate, patientSchema, appointmentSchema } = require('../services/validationService');
const {
    listPatients, createPatient,
    listAppointments, createAppointment,
    updateAppointmentStatus, deleteAppointment
} = require('../services/appointmentService');

router.get('/patients', asyncHandler(async (req, res) => {
    const { data } = await listPatients(req.clinicId);
    res.json(data);
}));

router.post('/patients', validate(patientSchema), asyncHandler(async (req, res) => {
    const { name, phone, email } = req.body;
    const { data } = await createPatient(
        { clinicId: req.clinicId, name, phone, email },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

router.get('/appointments', asyncHandler(async (req, res) => {
    const { data } = await listAppointments(req.clinicId);
    res.json(data);
}));

router.post('/appointments', validate(appointmentSchema), asyncHandler(async (req, res) => {
    const { patientId, reason, startTime, endTime, priority } = req.body;
    const { data } = await createAppointment(
        { clinicId: req.clinicId, patientId, reason, startTime, endTime, priority },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

router.put('/appointments/:id/status', asyncHandler(async (req, res) => {
    const { status } = req.body;
    const { data } = await updateAppointmentStatus(
        { clinicId: req.clinicId, appointmentId: req.params.id, status },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

router.delete('/appointments/:id', asyncHandler(async (req, res) => {
    await deleteAppointment(
        { clinicId: req.clinicId, appointmentId: req.params.id },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true });
}));


// GET /api/appointments/available?date=2026-04-22
router.get('/appointments/available', asyncHandler(async (req, res) => {
    const { date } = req.query;
    const { getAvailableSlots } = require('../services/appointmentService');
    const targetDate = date ? new Date(date) : new Date();
    const slots = await getAvailableSlots(req.clinicId, targetDate);
    res.json({ success: true, date: targetDate.toISOString().split('T')[0], slots });
}));

module.exports = router;

