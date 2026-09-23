const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');
const { sendSms } = require('./twilioService');

async function sendManagedSms({ clinicId, clinic, eventType, payload, logType = 'SMS', treatMissingWebhookAsSimulated = false }) {
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (clinic.messageCredits <= 0) {
        throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
    }
    await assertWithinSmsLimit(clinicId);

    let webhookResult = { success: true };
    const hasAnyWebhook = !!(clinic.webhookUrl || clinic.webhookMissedCall || clinic.webhookAppointment ||
        clinic.webhookReminders || clinic.webhookDirectSms || clinic.webhookInboundSms || process.env.N8N_WEBHOOK_URL);

    if (hasAnyWebhook) {
        try {
            webhookResult = await triggerWebhook(
                eventType,
                payload,
                clinic.webhookUrl || null,  // pass null to let resolveWebhookUrl pick event-specific URL
                clinic.webhookSecret,
                { awaitResponse: true, clinic }
            );
        } catch (err) {
            webhookResult = { success: false, message: err.message };
        }
    } else if (!treatMissingWebhookAsSimulated) {
        webhookResult = { success: false, message: 'No webhook URL configured' };
    }

    let twilioFallbackSuccess = false;
    // Twilio fallback when no webhook is configured or the webhook failed.
    // IMPORTANT: credit/usage accounting happens exactly once below, after delivery.
    // Do not use sendSmsWithTracking here because that function also decrements credits.
    if (!hasAnyWebhook || !webhookResult.success) {
        try {
            if (payload?.phone) {
                const twilioResult = await sendSms({
                    to: payload.phone,
                    body: payload.message || payload.body || '',
                });
                if (twilioResult.success) {
                    twilioFallbackSuccess = true;
                } else {
                    webhookResult = { success: false, message: twilioResult.error || 'SMS delivery failed' };
                }
            }
        } catch (twilioErr) {
            logger.warn(`Twilio fallback failed`, { err: twilioErr.message, clinicId });
            webhookResult = { success: false, message: twilioErr.message || 'SMS delivery failed' };
        }
    }

    const deliveryStatus = (hasAnyWebhook && webhookResult.success) || twilioFallbackSuccess
        ? 'SENT'
        : (treatMissingWebhookAsSimulated && !hasAnyWebhook ? 'SIMULATED' : 'FAILED');

    const log = await prisma.$transaction(async (tx) => {
        const updated = await tx.clinic.updateMany({
            where: { id: clinicId, messageCredits: { gt: 0 } },
            data: { messageCredits: { decrement: 1 } }
        });
        if (updated.count === 0) {
            throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
        }
        await incrementSmsUsage(clinicId, tx);

        // A failed delivery is still an attempted SMS for usage/rate-limit
        // purposes, but the clinic must not permanently lose a message credit.
        if (deliveryStatus === 'FAILED') {
            await tx.clinic.update({
                where: { id: clinicId },
                data: { messageCredits: { increment: 1 } }
            });
        }

        return tx.messageLog.create({
            data: {
                clinicId,
                type: logType,
                status: deliveryStatus,
                cost: 1,
                error: (webhookResult.success || twilioFallbackSuccess) ? null : (webhookResult.message || 'Webhook failed')
            }
        });
    });

    if (deliveryStatus === 'FAILED') {
        throw new AppError('SMS_SEND_FAILED', 'SMS_SEND_FAILED', 502, { type: 'sms', reason: webhookResult.message || 'Delivery failed' });
    }
    return { logId: log.id, deliveryStatus };
}

async function sendDirectMessage({ clinicId, patientId, message, type = 'SMS', clinic }, actor) {
    const patient = await prisma.patient.findFirst({
        where: { id: patientId, clinicId }
    });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);
    const result = await sendManagedSms({
        clinicId,
        clinic,
        eventType: 'message.direct_send',
        payload: { 
            patientId, 
            patientName: patient.name, 
            phone: require('../utils/phone').normalizePhone(patient.phone), 
            message, 
            type,
        },
        logType: type,
        treatMissingWebhookAsSimulated: false,
    });

try {
          await logAction({
            clinicId,
            userId: actor?.userId,
            action: 'SEND_DIRECT_MESSAGE',
            entity: 'PATIENT',
            entityId: patientId,
            details: { message, status: result.deliveryStatus },
            ipAddress: actor?.ip
          });
        } catch (logErr) {
          logger.warn('Messaging Audit log failed', { error: logErr.message });
        }

    return { success: true, data: { logId: result.logId, deliveryStatus: result.deliveryStatus } };
}

module.exports = { sendDirectMessage, sendManagedSms };
