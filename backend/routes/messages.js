const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const Joi = require('joi');
const { sendDirectMessage } = require('../services/messagingService');

const messageSchema = Joi.object({
    patientId: Joi.string().optional(),
    phone: Joi.string().optional(),
    message: Joi.string().min(1).max(1600).required(),
    type: Joi.string().valid('SMS', 'WHATSAPP').default('SMS'),
}).or('patientId', 'phone');

router.post('/send', asyncHandler(async (req, res) => {
    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { patientId, phone, message, type } = value;

    // If no patientId but phone provided, look up or create the patient
    let resolvedPatientId = patientId;
    if (!resolvedPatientId && phone) {
        const { normalizePhone } = require('../utils/phone');
        const normalized = normalizePhone(phone);
        const prisma = require('../services/prisma');
        let patient = await prisma.patient.findFirst({
            where: { clinicId: req.clinicId, phone: normalized }
        });
        if (!patient) {
            // Use last 4 digits as placeholder name instead of full phone number
            const last4 = normalized.slice(-4);
            const placeholderName = `Ασθενής ***${last4}`;
            patient = await prisma.patient.create({
                data: { clinicId: req.clinicId, name: placeholderName, phone: normalized }
            });
        }
        resolvedPatientId = patient.id;
    }

    const { data } = await sendDirectMessage(
        { clinicId: req.clinicId, patientId: resolvedPatientId, message, type, clinic: req.clinic },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json({ success: true, ...data });
}));

module.exports = router;
