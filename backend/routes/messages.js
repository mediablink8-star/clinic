const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const Joi = require('joi');
const { sendDirectMessage } = require('../services/messagingService');

const messageSchema = Joi.object({
    patientId: Joi.string().required(),
    message: Joi.string().min(1).max(1600).required(),
    type: Joi.string().valid('SMS', 'WHATSAPP').default('SMS'),
});

router.post('/send', asyncHandler(async (req, res) => {
    const { error, value } = messageSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { patientId, message, type } = value;
    const { data } = await sendDirectMessage(
        { clinicId: req.clinicId, patientId, message, type, clinic: req.clinic },
        { userId: req.user.userId, ip: req.ip }
    );
    res.json(data);
}));

module.exports = router;
