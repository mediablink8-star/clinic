const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');

async function sendManagedSms({ clinicId, clinic, eventType, payload, logType = 'SMS', treatMissingWebhookAsSimulated = true }) {
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (clinic.messageCredits <= 0) {
        throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
    }
    await assertWithinSmsLimit(clinicId);

    let webhookResult = { success: true };
    if (clinic.webhookUrl) {
        try {
            webhookResult = await triggerWebhook(
                eventType,
                payload,
                clinic.webhookUrl,
                clinic.webhookSecret,
                { awaitResponse: true, clinic }
            );
        } catch (err) {
            webhookResult = { success: false, message: err.message };
        }
    } else if (!treatMissingWebhookAsSimulated) {
        webhookResult = { success: false, message: 'No webhook URL configured' };
    }

    const deliveryStatus = clinic.webhookUrl
        ? (webhookResult.success ? 'SENT' : 'FAILED')
        : (treatMissingWebhookAsSimulated ? 'SIMULATED' : 'FAILED');

    const log = await prisma.$transaction(async (tx) => {
        await tx.clinic.update({
            where: { id: clinicId },
            data: { messageCredits: { decrement: 1 }, dailyUsedCount: { increment: 1 } }
        });
        await incrementSmsUsage(clinicId, tx);
        return tx.messageLog.create({
            data: {
                clinicId,
                type: logType,
                status: deliveryStatus,
                cost: 1,
                error: webhookResult.success ? null : (webhookResult.message || 'Webhook failed')
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
        payload: { patientId, patientName: patient.name, phone: patient.phone, message, type },
        logType: type,
        treatMissingWebhookAsSimulated: true,
    });

    await logAction({
        clinicId,
        userId: actor.userId,
        action: 'SEND_DIRECT_MESSAGE',
        entity: 'PATIENT',
        entityId: patientId,
        details: { message, status: result.deliveryStatus },
        ipAddress: actor.ip
    });

    return { success: true, data: { logId: result.logId, deliveryStatus: result.deliveryStatus } };
}

module.exports = { sendDirectMessage, sendManagedSms };
