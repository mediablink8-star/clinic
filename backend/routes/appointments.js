const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const {
    listPatients, createPatient,
    listAppointments, createAppointment,
    updateAppointmentStatus, deleteAppointment
} = require('../services/appointmentService');

router.get('/patients', asyncHandler(async (req, res) => {
    const { data } = await listPatients(req.clinicId);
    res.json(data);
}));

router.post('/patients', asyncHandler(async (req, res) => {
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

router.post('/appointments', asyncHandler(async (req, res) => {
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

module.exports = router;
