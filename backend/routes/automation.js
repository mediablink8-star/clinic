const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const { handleMissedCall, processScheduledMissedCalls } = require('../services/missedCallService');
const { getDueNotifications, processNotification } = require('../services/notificationService');
const { markRecoveryCaseRecovered } = require('../services/recoveryTrackingService');
const { validate, missedCallSchema, markRecoveredSchema, sendNotificationSchema } = require('../services/validationService');
const { validateWebhookSecret, validateSystemSecret } = require('../middleware/webhookSecurity');
const prisma = require('../services/prisma');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const AppError = require('../errors/AppError');

/**
 * POST /api/automation/missed-call
 */
router.post('/missed-call', validateWebhookSecret, validate(missedCallSchema), asyncHandler(async (req, res) => {
    const { phone, clinicId, callSid } = req.body;
    const { data } = await handleMissedCall({ phone, clinicId, callSid });
    res.json({ success: true, data });
}));

/**
 * POST /api/automation/process-missed-calls
 */
router.post('/process-missed-calls', validateSystemSecret, asyncHandler(async (req, res) => {
    const processed = await processScheduledMissedCalls();
    res.json({ success: true, data: { ...processed, processedCount: processed.processed } });
}));

/**
 * GET /api/automation/pending-notifications
 */
router.get('/pending-notifications', validateSystemSecret, asyncHandler(async (req, res) => {
    const notifications = await getDueNotifications();
    res.json({ success: true, data: notifications });
}));

/**
 * POST /api/automation/send-notification
 */
router.post('/send-notification', validateSystemSecret, validate(sendNotificationSchema), asyncHandler(async (req, res) => {
    const { notificationId } = req.body;
    const result = await processNotification(notificationId);
    res.json({ success: result.success, data: result.reason ? { reason: result.reason } : {} });
}));

/**
 * POST /api/automation/mark-recovered
 */
router.post('/mark-recovered', validateWebhookSecret, validate(markRecoveredSchema), asyncHandler(async (req, res) => {
    const { clinicId, missedCallId } = req.body;
    const result = await markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt: new Date() });
    res.json({ success: true, data: { missedCallId, status: 'RECOVERED' } });
}));

/**
 * POST /api/automation/log-error
 */
router.post('/log-error', validateSystemSecret, asyncHandler(async (req, res) => {
    const { type, workflow, error, executionId, timestamp } = req.body;
    logger.error(`[n8n] ${workflow} failed`, { type, workflow, error, executionId, timestamp });
    
    if (error && (error.includes('Twilio') || error.includes('401') || error.includes('403'))) {
        const { sendSmsFailureAlert } = require('../services/emailService');

        // Only alert the clinic that triggered the error, not all owners
        const clinicId = req.body?.clinicId;
        if (!clinicId) {
            logger.warn('log-error: no clinicId provided, skipping email alerts');
            return res.json({ success: true });
        }

        const admins = await prisma.user.findMany({
            where: { role: 'OWNER', clinicId },
            select: { email: true }
        });

        for (const admin of admins) {
            await sendSmsFailureAlert(admin.email, 'SYSTEM', 'GLOBAL', `Critical n8n Error: ${error} in ${workflow}`)
                .catch(err => logger.error('Alert Failed to send system error email', { error: err.message }));
        }
    }

    res.json({ success: true });
}));

/**
 * POST /api/automation/verify-appointment
 */
router.post('/verify-appointment', validateWebhookSecret, asyncHandler(async (req, res) => {
    const { appointmentId, patientPhone, clinicId } = req.body;
    
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, clinicId },
        include: { patient: true, clinic: true }
    });

    if (!appointment) {
        return res.json({ success: false, error: 'Appointment not found' });
    }

    const { normalizePhone } = require('../utils/phone');
    if (normalizePhone(appointment.patient.phone) !== normalizePhone(patientPhone)) {
        return res.json({ success: false, error: 'Phone mismatch' });
    }

    const { formatInTimeZone } = require('date-fns-tz');
    const timezone = appointment.clinic.timezone || DEFAULT_TIMEZONE;

    res.json({ 
        success: true, 
        appointmentDate: formatInTimeZone(appointment.startTime, timezone, 'yyyy-MM-dd'),
        appointmentTime: formatInTimeZone(appointment.startTime, timezone, 'HH:mm'),
        clinicName: appointment.clinic.name 
    });
}));

/**
 * POST /api/automation/log-sms
 */
router.post('/log-sms', validateWebhookSecret, asyncHandler(async (req, res) => {
    const { appointmentId, patientPhone, sid, status, type, from } = req.body;
    
    await prisma.messageLog.create({
        data: {
            clinicId: req.body.clinicId,
            appointmentId: appointmentId || null,
            toPhone: patientPhone || from || 'unknown',
            providerMessageSid: sid,
            status: status === 'delivered' ? 'DELIVERED' : 'SENT',
            providerStatusRaw: `n8n_${type}_${status}`
        }
    });

    res.json({ success: true });
}));

/**
 * POST /api/automation/log-missed-call
 */
router.post('/log-missed-call', validateWebhookSecret, asyncHandler(async (req, res) => {
    const { callerPhone, clinicId, sid, status } = req.body;
    
    const mc = await prisma.missedCall.findFirst({
        where: { fromNumber: callerPhone, clinicId, status: 'RECOVERING' },
        orderBy: { createdAt: 'desc' }
    });

    if (mc) {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { 
                smsStatus: status === 'delivered' ? 'sent' : 'processing',
                totalContactAttempts: { increment: 1 }
            }
        });
    }

    res.json({ success: true });
}));

/**
 * POST /api/automation/send-sms
 */
router.post('/send-sms', validateWebhookSecret, asyncHandler(async (req, res) => {
    const { to, body, clinicId } = req.body;
    if (!to || !body || !clinicId) {
        throw new AppError('VALIDATION_ERROR', 'to, body, and clinicId are required', 400);
    }

    const { sendSmsWithTracking } = require('../services/twilioService');
    const result = await sendSmsWithTracking({ to, body, clinicId });

    if (!result.success) {
        throw new AppError('SMS_SEND_FAILED', result.error || 'Failed to send SMS', 500);
    }

    res.json({ success: true, sid: result.sid });
}));

module.exports = router;
