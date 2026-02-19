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
    workingHours: Joi.object(),
    services: Joi.array().items(Joi.string()),
    policies: Joi.array().items(Joi.string())
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }
    next();
};

module.exports = {
    patientSchema,
    appointmentSchema,
    clinicUpdateSchema,
    loginSchema,
    validate
};
