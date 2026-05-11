const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
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
    const { doctorId } = req.query;
    const { data } = await listAppointments(req.clinicId, doctorId);
    res.json(data);
}));

router.post('/appointments', validate(appointmentSchema), asyncHandler(async (req, res) => {
    const { patientId, reason, startTime, endTime, priority, doctorId } = req.body;
    const { data } = await createAppointment(
        { clinicId: req.clinicId, patientId, reason, startTime, endTime, priority, doctorId },
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

// PATCH /api/appointments/:id/doctor — reassign or unassign doctor
router.patch('/appointments/:id/doctor', asyncHandler(async (req, res) => {
    const { doctorId } = req.body; // null to unassign
    const existing = await require('../services/prisma').appointment.findFirst({
        where: { id: req.params.id, clinicId: req.clinicId }
    });
    if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

    if (doctorId) {
        const doctor = await require('../services/prisma').doctor.findFirst({
            where: { id: doctorId, clinicId: req.clinicId, isActive: true }
        });
        if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    }

    const updated = await require('../services/prisma').appointment.update({
        where: { id: req.params.id },
        data: { doctorId: doctorId || null },
        include: { doctor: true, patient: true }
    });
    res.json({ success: true, data: updated });
}));


// GET /api/appointments/available?date=2026-04-22
router.get('/appointments/available', asyncHandler(async (req, res) => {
    const { date, doctorId } = req.query;
    const { getAvailableSlots } = require('../services/appointmentService');
    const targetDate = date ? new Date(date) : new Date();

    if (isNaN(targetDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date provided', 400);
    }

    const slots = await getAvailableSlots(req.clinicId, targetDate, doctorId);
    res.json({ success: true, date: targetDate.toISOString().split('T')[0], slots });
}));

module.exports = router;

