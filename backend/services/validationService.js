const Joi = require('joi');

const patientSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9+() \-]{7,20}$/).required(),
    email: Joi.string().email().allow(null, '')
});

const appointmentSchema = Joi.object({
    patientId: Joi.string().required(),
    startTime: Joi.date().iso().required(),
    endTime: Joi.date().iso().required(),
    reason: Joi.string().max(500).allow(null, '')
});

const clinicUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(/^[0-9+() \-]{7,20}$/),
    email: Joi.string().email(),
    webhookUrl: Joi.string().uri().allow(null, ''),
    webhookMissedCall: Joi.string().uri().allow(null, ''),
    webhookAppointment: Joi.string().uri().allow(null, ''),
    webhookReminders: Joi.string().uri().allow(null, ''),
    webhookDirectSms: Joi.string().uri().allow(null, ''),
    webhookInboundSms: Joi.string().uri().allow(null, ''),
    workingHours: Joi.object(),
    services: Joi.array().items(Joi.string()),
    policies: Joi.array().items(Joi.string()),
    apiKeys: Joi.object()
});

const clinicInfoSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[0-9+() \-]{7,20}$/).required(),
    email: Joi.string().email().required(),
    location: Joi.string().max(200).allow(null, ''),
    timezone: Joi.string().max(60).allow(null, '')
});

const aiConfigSchema = Joi.object({
    services: Joi.string().allow(''),
    workingHours: Joi.object().required(),
    avgAppointmentValue: Joi.number().min(0),
    policies: Joi.string().allow(''),
    tone: Joi.string().valid('Professional', 'Friendly', 'Sales', 'Formal').required(),
    languages: Joi.array().items(Joi.string().valid('Greek', 'English')).min(1).required()
});

const webhookSchema = Joi.object({
    url: Joi.string().uri().allow(null, ''),
    secret: Joi.string().min(8).max(100).allow(null, '').message('Webhook Secret must be at least 8 characters if provided.'),
    webhookMissedCall: Joi.string().uri().allow(null, ''),
    webhookAppointment: Joi.string().uri().allow(null, ''),
    webhookReminders: Joi.string().uri().allow(null, ''),
    webhookDirectSms: Joi.string().uri().allow(null, ''),
    webhookInboundSms: Joi.string().uri().allow(null, '')
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
    clinicName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^[0-9+() \-]{7,20}$/).required(),
    agreedToTerms: Joi.boolean().valid(true).required()
});

const validate = (schema) => (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        console.warn(`[VALIDATION] Empty body received for ${req.url}`);
        return res.status(400).json({ error: 'Request body is missing or empty' });
    }
    const { error } = schema.validate(req.body);
    if (error) {
        console.warn(`[VALIDATION] Error for ${req.url}:`, error.details[0].message);
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};

module.exports = {
    patientSchema,
    appointmentSchema,
    clinicUpdateSchema,
    clinicInfoSchema,
    aiConfigSchema,
    webhookSchema,
    loginSchema,
    resetPasswordSchema,
    registerSchema,
    validate
};
