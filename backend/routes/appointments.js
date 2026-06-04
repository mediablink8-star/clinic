const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const { validate, patientSchema, appointmentSchema } = require('../services/validationService');
const {
    listPatients, createPatient,
    listAppointments, createAppointment,
    updateAppointmentStatus, deleteAppointment, restoreAppointment
} = require('../services/appointmentService');
const { deletePatient, restorePatient } = require('../services/patientService');

router.get('/patients', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const deleted = req.query.deleted === 'true';
    const { data, total, totalPages } = await listPatients(req.clinicId, page, limit, deleted, req.user);
    res.json({ data, total, page, limit, totalPages });
}));

router.post('/patients', validate(patientSchema), asyncHandler(async (req, res) => {
    const { name, phone, email, amka } = req.body;
    const { data } = await createPatient(
        { clinicId: req.clinicId, name, phone, email, amka },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

router.delete('/patients/:id', asyncHandler(async (req, res) => {
    await deletePatient(req.clinicId, req.params.id, { userId: req.user.userId, ip: req.ip });
    res.json({ success: true });
}));

router.post('/patients/:id/restore', asyncHandler(async (req, res) => {
    await restorePatient(req.clinicId, req.params.id, { userId: req.user.userId, ip: req.ip });
    res.json({ success: true });
}));

router.get('/appointments', asyncHandler(async (req, res) => {
    const { doctorId, page, limit } = req.query;
    const p = parseInt(page) || 1;
    const l = parseInt(limit) || 50;
    const deleted = req.query.deleted === 'true';
    const { data, total, totalPages } = await listAppointments(req.clinicId, doctorId, p, l, deleted, req.user);
    res.json({ data, total, page: p, limit: l, totalPages });
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

router.post('/appointments/:id/restore', asyncHandler(async (req, res) => {
    await restoreAppointment(
        { clinicId: req.clinicId, appointmentId: req.params.id },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true });
}));

// PATCH /api/appointments/:id/doctor — reassign or unassign doctor
router.patch('/appointments/:id/doctor', asyncHandler(async (req, res) => {
const { doctorId } = req.body;
const existing = await prisma.appointment.findFirst({
    where: { id: req.params.id, clinicId: req.clinicId }
});
if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

if (doctorId) {
    const doctor = await prisma.doctor.findFirst({
        where: { id: doctorId, clinicId: req.clinicId, isActive: true }
    });
    if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);

    // Check for double-booking with the new doctor
    const conflict = await prisma.$queryRaw`
        SELECT id FROM "Appointment"
        WHERE "clinicId" = ${req.clinicId}
        AND "doctorId" = ${doctorId}
        AND id != ${req.params.id}
        AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
        AND "startTime" < ${existing.endTime}
        AND "endTime" > ${existing.startTime}
        LIMIT 1
    `;
    if (conflict && conflict.length > 0) {
        throw new AppError('CONFLICT', 'This doctor already has an appointment at this time', 409);
    }
}

const updated = await prisma.appointment.update({
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

