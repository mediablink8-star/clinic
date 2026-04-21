const prisma = require('./prisma');
const { checkWorkingHours } = require('./workingHours');
const AppError = require('../errors/AppError');
const {
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
    markRecoveryCaseRecovered,
} = require('./recoveryTrackingService');
const { sendManagedSms } = require('./messagingService');
const { assertWithinSmsLimit, incrementSmsUsage } = require('./usageService');
const https = require('https');
const { decrypt } = require('./encryptionService');
const { sendSmsFailureAlert } = require('./emailService');
const { triggerOutboundCall } = require('./blandService');
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

async function handleMissedCall({ phone, clinicId, callSid, bypassCooldown = false }) {
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

    // ── SMS Cooldown check ────────────────────────────────────────────────────
    // Skip SMS if same phone has an ACTIVE/RECOVERING case with SMS sent < 6h ago
    // AND no inbound reply since last SMS (patient hasn't engaged)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentActive = await prisma.missedCall.findFirst({
        where: {
            clinicId,
            fromNumber: phone,
            status: { in: ['DETECTED', 'RECOVERING'] },
            lastSmsSentAt: { gte: sixHoursAgo },
        },
        orderBy: { lastSmsSentAt: 'desc' },
        include: {
            recoveryCase: {
                include: {
                    conversation: {
                        include: {
                            messages: {
                                where: { direction: 'INBOUND' },
                                orderBy: { createdAt: 'desc' },
                                take: 1,
                            }
                        }
                    }
                }
            }
        }
    });

    if (recentActive && !bypassCooldown) {
        const lastInbound = recentActive.recoveryCase?.conversation?.messages?.[0];
        const hasReplied = lastInbound && lastInbound.createdAt > recentActive.lastSmsSentAt;
        if (!hasReplied) {
            // Patient hasn't replied and cooldown active — skip SMS, just log
            console.log(`[Cooldown] Skipping SMS for ${phone} — active case ${recentActive.id} within 6h`);
            const missedCall = await prisma.missedCall.create({
                data: {
                    clinicId,
                    fromNumber: phone,
                    callSid: callSid || null,
                    status: 'DETECTED',
                    smsStatus: 'skipped',
                    smsError: 'Cooldown — active case within 6h',
                    estimatedRevenue: (() => {
                        try {
                            const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
                            return parseFloat(ai.avgAppointmentValue) || 80;
                        } catch { return 80; }
                    })(),
                }
            });
            await ensureRecoveryCaseForMissedCall(missedCall.id);
            return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'skipped', reason: 'cooldown' } };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
            estimatedRevenue: (() => {
                try {
                    const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
                    return parseFloat(ai.avgAppointmentValue) || 80;
                } catch { return 80; }
            })(),
        }
    });

    await ensureRecoveryCaseForMissedCall(missedCall.id);

    // ── Voice call (Bland AI) — if enabled, call patient first ───────────────
    // Voice calls trigger regardless of working hours — AI handles closed hours messaging
    if (clinic.voiceEnabled) {
        const callResult = await triggerOutboundCall({
            clinic,
            phone,
            missedCallId: missedCall.id,
            patientName: null,
        });
        if (callResult.success) {
            console.log(`[Voice] Outbound call triggered for ${phone} — callId: ${callResult.callId}`);
            await prisma.missedCall.update({
                where: { id: missedCall.id },
                data: { smsStatus: 'pending', aiConversation: JSON.stringify([{ role: 'system', content: `bland_call_id:${callResult.callId}` }]) }
            });
            // SMS fallback will be triggered by Bland webhook if call unanswered
            return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'pending', callId: callResult.callId, channel: 'voice' } };
        }
        console.warn(`[Voice] Call failed (${callResult.reason}) — falling back to SMS`);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Enforce SMS limits before triggering n8n
    try {
        await assertWithinSmsLimit(clinicId);
    } catch (limitErr) {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsStatus: 'failed', smsError: limitErr.code || 'Usage limit reached' }
        });
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'failed', reason: 'limit_reached' } };
    }

    // Non-blocking trigger to n8n missed call recovery workflow
    const clinicName = clinic.name || 'το ιατρείο';
    const defaultSms = `Γεια 👋 χάσαμε την κλήση σας στο ${clinicName}.\nΠώς μπορούμε να βοηθήσουμε;\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση`;
    let smartSmsBody = defaultSms;
    try {
        const aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        if (aiCfg.smsInitial && aiCfg.smsInitial.trim()) {
            smartSmsBody = aiCfg.smsInitial.replace('{clinic_name}', clinicName);
        }
    } catch { /* use default */ }

    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    // Resolve per-clinic Vonage credentials (decrypt if stored)
    const vonageApiKey = clinic.vonageApiKey ? decrypt(clinic.vonageApiKey) : null;
    const vonageApiSecret = clinic.vonageApiSecret ? decrypt(clinic.vonageApiSecret) : null;

    triggerN8n('/missed-call', {
        clinicId,
        missedCallId: missedCall.id,
        phone,
        name: null,
        smsBody: smartSmsBody,
        backendUrl: process.env.BACKEND_API_URL || '',
        ...(vonageApiKey && { vonageApiKey }),
        ...(vonageApiSecret && { vonageApiSecret }),
        ...(clinic.vonageFromName && { vonageFromName: clinic.vonageFromName }),
    });

    // Increment SMS usage counter
    incrementSmsUsage(clinicId).catch(err => console.warn(`[USAGE] increment failed: ${err.message}`));

    if (!withinHours) {
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'scheduled', scheduledSmsAt: scheduledAt } };
    }

    // If N8N_WEBHOOK_URL is set, n8n handles SMS delivery — mark as sent and return
    if (n8nUrl) {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsStatus: 'sent', lastSmsSentAt: new Date() }
        });
        await recordOutboundMessageForMissedCall({
            missedCallId: missedCall.id,
            status: 'QUEUED',
            providerStatusRaw: 'n8n_queued',
            fromPhone: clinic.phone || null,
            toPhone: phone,
        });
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'sent', scheduledSmsAt: null } };
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

    // Alert clinic owner on SMS failure
    if (!webhookResult.success) {
        const owner = await prisma.user.findFirst({
            where: { clinicId, role: { in: ['OWNER', 'ADMIN'] } },
            select: { email: true }
        });
        if (owner?.email) {
            sendSmsFailureAlert(owner.email, clinic.name, phone, webhookResult.error || 'Webhook failed')
                .catch(() => {});
        }
    }

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
