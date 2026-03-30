const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { checkWorkingHours } = require('./workingHours');
const AppError = require('../errors/AppError');

async function handleMissedCall({ phone, clinicId, callSid }) {
    // Dedup by callSid — scoped to clinicId
    if (callSid) {
        const existing = await prisma.missedCall.findFirst({ where: { callSid, clinicId } });
        if (existing) return { success: true, data: { duplicate: true, missedCallId: existing.id } };
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const aiConfig = JSON.parse(clinic.aiConfig || '{}');
    const { withinHours, scheduledAt } = checkWorkingHours(new Date(), aiConfig.workingHours || null);

    const missedCall = await prisma.missedCall.create({
        data: {
            clinicId,
            fromNumber: phone,
            callSid: callSid || null,
            status: 'RECOVERING',
            smsStatus: withinHours ? 'pending' : 'scheduled',
            scheduledSmsAt: withinHours ? null : scheduledAt,
            estimatedRevenue: 80
        }
    });

    if (!withinHours) {
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'scheduled', scheduledSmsAt: scheduledAt } };
    }

    // Mark processing
    await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: { smsStatus: 'processing' }
    });

    if (!clinic.webhookUrl) {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsStatus: 'pending' }
        });
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'pending', scheduledSmsAt: null } };
    }

    // Attempt webhook — always log outcome, never silent
    let webhookResult;
    try {
        webhookResult = await triggerWebhook(
            'missed_call.detected',
            { phone, missedCallId: missedCall.id, clinicId },
            clinic.webhookUrl,
            clinic.webhookSecret,
            { maxRetries: 3, baseDelay: 500 }
        );
    } catch (err) {
        webhookResult = { success: false, error: err.message };
    }

    const finalSmsStatus = webhookResult.success ? 'sent' : 'failed';
    await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: webhookResult.success
            ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
            : { smsStatus: 'failed', smsError: webhookResult.error || 'Webhook failed' }
    });

    return { success: true, data: { missedCallId: missedCall.id, smsStatus: finalSmsStatus, scheduledSmsAt: null } };
}

/**
 * Process all missed calls that were scheduled for later delivery.
 * Called by the cron worker — contains ALL delivery logic.
 * Returns count of processed items.
 */
async function processScheduledMissedCalls() {
    const now = new Date();
    const due = await prisma.missedCall.findMany({
        where: { smsStatus: 'scheduled', scheduledSmsAt: { lte: now } },
        include: { clinic: true }
    });

    let processed = 0;

    for (const mc of due) {
        const clinic = mc.clinic;
        if (!clinic) continue;

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { smsStatus: 'processing' }
        });

        if (!clinic.webhookUrl) {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { smsStatus: 'pending' }
            });
            processed++;
            continue;
        }

        let webhookResult;
        try {
            webhookResult = await triggerWebhook(
                'missed_call.detected',
                { phone: mc.fromNumber, missedCallId: mc.id, clinicId: mc.clinicId },
                clinic.webhookUrl,
                clinic.webhookSecret,
                { maxRetries: 3, baseDelay: 500 }
            );
        } catch (err) {
            webhookResult = { success: false, error: err.message };
        }

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: webhookResult.success
                ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
                : { smsStatus: 'failed', smsError: webhookResult.error || 'Webhook failed' }
        });

        processed++;
    }

    return processed;
}

async function retrySms({ clinicId, missedCallId }) {
    const mc = await prisma.missedCall.findUnique({
        where: { id: missedCallId },
        include: { clinic: true }
    });
    if (!mc || mc.clinicId !== clinicId) throw new AppError('NOT_FOUND', 'MissedCall not found', 404);
    if (mc.smsStatus !== 'failed') throw new AppError('INVALID_STATE', 'Only failed SMS can be retried', 400);

    const clinic = mc.clinic;
    if (!clinic.webhookUrl) throw new AppError('NO_WEBHOOK', 'No webhook URL configured', 400);

    await prisma.missedCall.update({ where: { id: mc.id }, data: { smsStatus: 'processing', smsError: null } });

    let webhookResult;
    try {
        webhookResult = await triggerWebhook(
            'missed_call.detected',
            { phone: mc.fromNumber, missedCallId: mc.id, clinicId },
            clinic.webhookUrl,
            clinic.webhookSecret,
            { maxRetries: 3, baseDelay: 500 }
        );
    } catch (err) {
        webhookResult = { success: false, error: err.message };
    }

    await prisma.missedCall.update({
        where: { id: mc.id },
        data: webhookResult.success
            ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
            : { smsStatus: 'failed', smsError: webhookResult.error || 'Webhook failed' }
    });

    return { success: webhookResult.success, data: { missedCallId: mc.id, smsStatus: webhookResult.success ? 'sent' : 'failed' } };
}

async function markRecovered({ clinicId, missedCallId }) {
    const existing = await prisma.missedCall.findUnique({
        where: { id: missedCallId, clinicId }
    });
    if (!existing) throw new AppError('NOT_FOUND', 'MissedCall not found', 404);

    // Idempotent: already recovered, return success without DB write
    if (existing.status === 'RECOVERED') {
        return { success: true, data: { missedCallId: existing.id, status: 'RECOVERED' } };
    }

    const updated = await prisma.missedCall.update({
        where: { id: missedCallId },
        data: { status: 'RECOVERED', recoveredAt: new Date() }
    });
    return { success: true, data: { missedCallId: updated.id, status: updated.status } };
}

module.exports = { handleMissedCall, processScheduledMissedCalls, retrySms, markRecovered };
