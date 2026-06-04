const Joi = require('joi');

const greekPhoneRegex = /^(\+30)?[26][0-9\s\-\(\)]{8,14}$/;
const greekPhoneMessage = 'Enter a valid Greek phone number, e.g. 2101234567 or 6912345678.';

const patientSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(greekPhoneRegex).required().messages({
        'string.pattern.base': greekPhoneMessage
    }),
    email: Joi.string().email().allow(null, ''),
    amka: Joi.string().allow(null, '').max(20)
});

const appointmentSchema = Joi.object({
    patientId: Joi.string().required(),
    startTime: Joi.date().iso(),
    endTime: Joi.date().iso(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    time: Joi.string().pattern(/^\d{2}:\d{2}$/),
    reason: Joi.string().max(500).allow(null, ''),
    priority: Joi.string().valid('NORMAL', 'URGENT').default('NORMAL'),
    doctorId: Joi.string().allow(null, ''),
    source: Joi.string().valid('MANUAL', 'PUBLIC_LINK', 'SMS_BOOKING', 'CALL_BOOKING', 'AI_VOICE')
}).or('startTime', 'date').with('startTime', 'endTime').with('date', 'time');

const clinicUpdateSchema = Joi.object({
    name: Joi.string().min(2).max(100),
    phone: Joi.string().pattern(greekPhoneRegex).messages({
        'string.pattern.base': greekPhoneMessage
    }),
    email: Joi.string().email(),
    webhookUrl: Joi.string().uri().allow(null, ''),
    webhookMissedCall: Joi.string().uri().allow(null, ''),
    webhookAppointment: Joi.string().uri().allow(null, ''),
    webhookReminders: Joi.string().uri().allow(null, ''),
    webhookDirectSms: Joi.string().uri().allow(null, ''),
    webhookInboundSms: Joi.string().uri().allow(null, ''),
    workingHours: Joi.object(),
    services: Joi.array().items(Joi.string()),
    policies: Joi.array().items(Joi.string())
});

const clinicInfoSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(greekPhoneRegex).required().messages({
        'string.pattern.base': greekPhoneMessage
    }),
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
    languages: Joi.array().items(Joi.string().valid('Greek', 'English', 'Ελληνικά', 'Αγγλικά')).min(0).required(),
    smsInitial: Joi.string().allow(''),
    smsBookingConfirm: Joi.string().allow(''),
    smsCallbackConfirm: Joi.string().allow(''),
    smsUnknown: Joi.string().allow('')
});

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const passwordMessage = 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.';

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    password: Joi.string().pattern(passwordRegex).required().messages({
        'string.pattern.base': passwordMessage
    })
});

const registerSchema = Joi.object({
    clinicName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().pattern(passwordRegex).required().messages({
        'string.pattern.base': passwordMessage
    }),
    phone: Joi.string().pattern(greekPhoneRegex).required().messages({
        'string.pattern.base': greekPhoneMessage
    }),
    inviteCode: Joi.string().allow(null, ''),
    agreedToTerms: Joi.boolean().valid(true).required()
});

const publicBookingSchema = Joi.object({
    clinicId: Joi.string().required(),
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(greekPhoneRegex).required().messages({
        'string.pattern.base': greekPhoneMessage
    }),
    email: Joi.string().email().allow(null, ''),
    reason: Joi.string().max(500).allow(null, ''),
    // Accept either startTime (ISO) or date+time (separate fields)
    startTime: Joi.date().iso(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/),
    time: Joi.string().pattern(/^\d{2}:\d{2}$/),
    // Optional: link to missed call for recovery tracking
    missedCallId: Joi.string().allow(null, ''),
    doctorId: Joi.string().allow(null, '')
}).or('startTime', 'date');

const missedCallSchema = Joi.object({
    phone: Joi.string().required(),
    clinicId: Joi.string().required(),
    callSid: Joi.string().allow(null, '')
});

const markRecoveredSchema = Joi.object({
    clinicId: Joi.string().required(),
    missedCallId: Joi.string().required()
});

const sendNotificationSchema = Joi.object({
    notificationId: Joi.string().required()
});

const addCreditsSchema = Joi.object({
    clinicId: Joi.string().required(),
    amount: Joi.number().integer().min(1).max(10000).required()
});

const AppError = require('../errors/AppError');
const logger = require('../utils/logger');

const validate = (schema) => (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        logger.warn(`Empty body received`, { url: req.url });
        throw new AppError('VALIDATION_ERROR', 'Request body is missing or empty', 400);
    }
    const { error } = schema.validate(req.body);
    if (error) {
        logger.warn(`Validation error`, { url: req.url, detail: error.details[0].message });
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
    }
    next();
};

module.exports = {
    patientSchema,
    appointmentSchema,
    clinicUpdateSchema,
    clinicInfoSchema,
    aiConfigSchema,
    loginSchema,
    resetPasswordSchema,
    registerSchema,
    publicBookingSchema,
    missedCallSchema,
    markRecoveredSchema,
    sendNotificationSchema,
    addCreditsSchema,
    validate
};
