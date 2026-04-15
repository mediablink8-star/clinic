const prisma = require('./prisma');
const { checkWorkingHours } = require('./workingHours');
const AppError = require('../errors/AppError');
const {
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
    markRecoveryCaseRecovered,
} = require('./recoveryTrackingService');
const { sendManagedSms } = require('./messagingService');
const https = require('https');
const http = require('http');

/**
 * Non-blocking fire-and-forget trigger to n8n.
 * Never throws — failures are logged only.
 */
function triggerN8n(path, payload) {
    const baseUrl = process.env.N8N_WEBHOOK_URL;
    if (!baseUrl) return;

    const url = `${baseUrl.replace(/\/$/, '')}${path}`;
    const body = JSON.stringify(payload);
    const secret = process.env.WEBHOOK_SECRET || '';

    try {
        const parsed = new URL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-api-key': secret,
            },
        }, (res) => {
            res.resume(); // drain response
            if (res.statusCode >= 400) {
                console.warn(`[N8N] ${path} responded ${res.statusCode}`);
            }
        });
        req.on('error', (err) => console.warn(`[N8N] trigger failed: ${err.message}`));
        req.setTimeout(8000, () => { req.destroy(); console.warn(`[N8N] ${path} timeout`); });
        req.write(body);
        req.end();
    } catch (err) {
        console.warn(`[N8N] trigger error: ${err.message}`);
    }
}

async function handleMissedCall({ phone, clinicId, callSid }) {
    if (callSid) {
        const existing = await prisma.missedCall.findFirst({ where: { callSid, clinicId } });
        if (existing) {
            await ensureRecoveryCaseForMissedCall(existing.id);
            return { success: true, data: { duplicate: true, missedCallId: existing.id } };
        }
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    if (clinic.isActive === false) {
        return { success: false, error: 'Clinic inactive' };
    }

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
            estimatedRevenue: 80,
        }
    });

    await ensureRecoveryCaseForMissedCall(missedCall.id);

    // Non-blocking trigger to n8n missed call recovery workflow
    triggerN8n('/missed-call', {
        clinicId,
        missedCallId: missedCall.id,
        phone,
        name: null,
    });

    if (!withinHours) {
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'scheduled', scheduledSmsAt: scheduledAt } };
    }

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

    let webhookResult;
    try {
        await sendManagedSms({
            clinicId,
            clinic,
            eventType: 'missed_call.detected',
            payload: { phone, missedCallId: missedCall.id, clinicId },
            logType: 'SMS',
        });
        webhookResult = { success: true };
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

    await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: webhookResult.success ? 'QUEUED' : 'FAILED',
        providerStatusRaw: webhookResult.success ? 'workflow_queued' : 'workflow_failed',
        fromPhone: clinic.phone || null,
        toPhone: phone,
        errorMessage: webhookResult.success ? null : (webhookResult.error || 'Webhook failed'),
    });

    return { success: true, data: { missedCallId: missedCall.id, smsStatus: finalSmsStatus, scheduledSmsAt: null } };
}

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

        if (clinic.isActive === false) {
            continue;
        }

        await ensureRecoveryCaseForMissedCall(mc.id);

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
            await sendManagedSms({
                clinicId: mc.clinicId,
                clinic,
                eventType: 'missed_call.detected',
                payload: { phone: mc.fromNumber, missedCallId: mc.id, clinicId: mc.clinicId },
                logType: 'SMS',
            });
            webhookResult = { success: true };
        } catch (err) {
            webhookResult = { success: false, error: err.message };
        }

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: webhookResult.success
                ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
                : { smsStatus: 'failed', smsError: webhookResult.error || 'Webhook failed' }
        });

        await recordOutboundMessageForMissedCall({
            missedCallId: mc.id,
            status: webhookResult.success ? 'QUEUED' : 'FAILED',
            providerStatusRaw: webhookResult.success ? 'workflow_queued' : 'workflow_failed',
            fromPhone: clinic.phone || null,
            toPhone: mc.fromNumber,
            errorMessage: webhookResult.success ? null : (webhookResult.error || 'Webhook failed'),
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

    await ensureRecoveryCaseForMissedCall(mc.id);

    await prisma.missedCall.update({ where: { id: mc.id }, data: { smsStatus: 'processing', smsError: null } });

    let webhookResult;
    try {
        await sendManagedSms({
            clinicId,
            clinic,
            eventType: 'missed_call.detected',
            payload: { phone: mc.fromNumber, missedCallId: mc.id, clinicId },
            logType: 'SMS',
        });
        webhookResult = { success: true };
    } catch (err) {
        webhookResult = { success: false, error: err.message };
    }

    await prisma.missedCall.update({
        where: { id: mc.id },
        data: webhookResult.success
            ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
            : { smsStatus: 'failed', smsError: webhookResult.error || 'Webhook failed' }
    });

    await recordOutboundMessageForMissedCall({
        missedCallId: mc.id,
        status: webhookResult.success ? 'QUEUED' : 'FAILED',
        providerStatusRaw: webhookResult.success ? 'workflow_queued' : 'workflow_failed',
        fromPhone: clinic.phone || null,
        toPhone: mc.fromNumber,
        errorMessage: webhookResult.success ? null : (webhookResult.error || 'Webhook failed'),
    });

    return { success: webhookResult.success, data: { missedCallId: mc.id, smsStatus: webhookResult.success ? 'sent' : 'failed' } };
}

async function markRecovered({ clinicId, missedCallId }) {
    const existing = await prisma.missedCall.findFirst({
        where: { id: missedCallId, clinicId }
    });
    if (!existing) throw new AppError('NOT_FOUND', 'MissedCall not found', 404);

    if (existing.status === 'RECOVERED') {
        await markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt: existing.recoveredAt || new Date() });
        return { success: true, data: { missedCallId: existing.id, status: 'RECOVERED' } };
    }

    const recoveredAt = new Date();
    const updated = await prisma.missedCall.update({
        where: { id: missedCallId },
        data: { status: 'RECOVERED', recoveredAt }
    });

    await markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt: recoveredAt });

    return { success: true, data: { missedCallId: updated.id, status: updated.status } };
}

module.exports = { handleMissedCall, processScheduledMissedCalls, retrySms, markRecovered };
