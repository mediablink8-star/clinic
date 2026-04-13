const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');

async function sendDirectMessage({ clinicId, patientId, message, type = 'SMS', clinic }, actor) {
    const patient = await prisma.patient.findUnique({
        where: { id: patientId, clinicId }
    });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

    if (clinic.messageCredits <= 0) {
        throw new AppError('INSUFFICIENT_CREDITS', 'Insufficient message credits', 403);
    }
    await assertWithinSmsLimit(clinicId);

    // Attempt webhook delivery — always structured, never silent
    let webhookResult = { success: true };
    if (clinic.webhookUrl) {
        try {
            webhookResult = await triggerWebhook(
                'message.direct_send',
                { patientId, patientName: patient.name, phone: patient.phone, message, type },
                clinic.webhookUrl,
                clinic.webhookSecret,
                { awaitResponse: true }
            );
        } catch (err) {
            // Webhook call itself threw — treat as failed delivery, do not swallow
            webhookResult = { success: false, message: err.message };
        }
    }

    const deliveryStatus = clinic.webhookUrl
        ? (webhookResult.success ? 'SENT' : 'FAILED')
        : 'SIMULATED';

    // Atomic: decrement credits + create log in one transaction
    const log = await prisma.$transaction(async (tx) => {
        await tx.clinic.update({
            where: { id: clinicId },
            data: { messageCredits: { decrement: 1 }, dailyUsedCount: { increment: 1 } }
        });
        await incrementSmsUsage(clinicId, tx);
        return tx.messageLog.create({
            data: {
                clinicId,
                type,
                status: deliveryStatus,
                cost: 1,
                error: webhookResult.success ? null : (webhookResult.message || 'Webhook failed')
            }
        });
    });

    await logAction({
        clinicId,
        userId: actor.userId,
        action: 'SEND_DIRECT_MESSAGE',
        entity: 'PATIENT',
        entityId: patientId,
        details: { message, status: deliveryStatus },
        ipAddress: actor.ip
    });

    return { success: true, data: { logId: log.id, deliveryStatus } };
}

module.exports = { sendDirectMessage };
