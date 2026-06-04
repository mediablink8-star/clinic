const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const {
    listDoctors,
    createDoctor,
    updateDoctor,
    deactivateDoctor,
    getDoctorAvailability,
    getDoctorAnalytics
} = require('../services/doctorService');

// Require OWNER or ADMIN role for mutating endpoints
const ROLE_HIERARCHY = ['ASSISTANT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN', 'OWNER'];
const requireStaffOrAbove = (req, res, next) => {
    const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user?.role);
    const requiredRoleIndex = ROLE_HIERARCHY.indexOf('RECEPTIONIST');
    if (userRoleIndex < requiredRoleIndex) {
        throw new AppError('FORBIDDEN', 'Forbidden: Insufficient permissions', 403);
    }
    next();
};

router.get('/', asyncHandler(async (req, res) => {
    const result = await listDoctors(req.clinicId);
    res.json(result);
}));

router.get('/analytics', asyncHandler(async (req, res) => {
    const result = await getDoctorAnalytics(req.clinicId);
    res.json(result);
}));

router.post('/', requireStaffOrAbove, asyncHandler(async (req, res) => {
    const { name, specialty, phone, email, workingHours, avgAppointmentValue } = req.body;
    const result = await createDoctor({
        clinicId: req.clinicId,
        name,
        specialty,
        phone,
        email,
        workingHours,
        avgAppointmentValue
    });
    res.json(result);
}));

router.put('/:doctorId', requireStaffOrAbove, asyncHandler(async (req, res) => {
    const { name, specialty, phone, email, workingHours, avatarUrl, avgAppointmentValue } = req.body;
    const result = await updateDoctor({
        clinicId: req.clinicId,
        doctorId: req.params.doctorId,
        name,
        specialty,
        phone,
        email,
        workingHours,
        avatarUrl,
        avgAppointmentValue
    });
    res.json(result);
}));

router.delete('/:doctorId', requireStaffOrAbove, asyncHandler(async (req, res) => {
    const result = await deactivateDoctor({
        clinicId: req.clinicId,
        doctorId: req.params.doctorId
    });
    res.json(result);
}));

router.get('/:doctorId/slots', asyncHandler(async (req, res) => {
    const { date } = req.query;
    const result = await getDoctorAvailability({
        clinicId: req.clinicId,
        doctorId: req.params.doctorId,
        date
    });
    res.json(result);
}));

module.exports = router;
