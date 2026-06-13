/**
 * Public lead-capture endpoints.
 *
 * Used by the marketing / request-a-demo form on the website. These endpoints
 * do NOT create a clinic or user — they only record an expression of interest
 * and email the platform owner. Clinic provisioning is a manual, high-touch
 * flow done by the platform owner via the admin panel.
 *
 * Rate-limited per IP to prevent abuse. No authentication required.
 */
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const logger = require('../utils/logger');
const { sendDemoRequest } = require('../services/emailService');
const { validate } = require('../middleware/validation');
const AppError = require('../errors/AppError');

const router = express.Router();

const demoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many demo requests. Please try again later.' },
});

const demoSchema = Joi.object({
    clinicName: Joi.string().min(2).max(120).required(),
    name: Joi.string().min(2).max(120).allow('', null),
    email: Joi.string().email().required(),
    phone: Joi.string().min(6).max(30).allow('', null),
    notes: Joi.string().max(2000).allow('', null),
});

router.post('/demo', demoLimiter, validate(demoSchema), asyncHandler(async (req, res) => {
    const { clinicName, name, email, phone, notes } = req.body;

    logger.info('Demo request received', {
        clinicName,
        email,
        phone: phone ? `${phone.slice(0, 4)}***` : null,
        ip: req.ip,
    });

    const sent = await sendDemoRequest({ clinicName, name, email, phone, notes });
    if (!sent) {
        // Don't fail the request — the lead is still valuable.
        // We just couldn't send the email. Owner can also see it in the logs.
        logger.warn('Demo request received but notification email not sent (check SALES_NOTIFY_EMAIL/SMTP config)');
    }

    res.json({ success: true });
}));

module.exports = router;
