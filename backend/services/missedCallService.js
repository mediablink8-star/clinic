const prisma = require('./prisma');
const { checkWorkingHours } = require('./workingHours');
const AppError = require('../errors/AppError');
const {
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
    markRecoveryCaseRecovered,
} = require('./recoveryTrackingService');
const { sendManagedSms } = require('./messagingService');
const { assertWithinSmsLimit } = require('./usageService');
const https = require('https');
const { sendSmsFailureAlert } = require('./emailService');
const http = require('http');
const { normalizePhone } = require('../utils/phone');

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
        const parsedUrl = new URL(url);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const req = lib.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-webhook-key': secret,
                'x-api-key': process.env.AUTOMATION_API_KEY || '',
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

    const normalizedPhone = normalizePhone(phone);
    const patient = await prisma.patient.findFirst({
        where: { clinicId, phone: normalizedPhone }
    });

    if (clinic.isActive === false) {
        return { success: false, error: 'Clinic inactive' };
    }

    // ── Opt-out check — never contact opted-out patients ─────────────────
    if (patient?.optedOut) {
        console.info(`[MissedCall] Skipping opted-out patient ***${normalizedPhone.slice(-4)}`);
        return { success: true, data: { skipped: true, reason: 'opted_out' } };
    }
    // ─────────────────────────────────────────────────────────────────────

    // Warn early if no recovery channel is configured
    const hasVoice = clinic.voiceEnabled && (clinic.vapiAssistantId || clinic.vapiPhoneNumberId) && (clinic.vapiApiKey || process.env.VAPI_API_KEY);
    const hasSms = !!(process.env.N8N_WEBHOOK_URL || clinic.webhookUrl || clinic.webhookMissedCall || clinic.vonageApiKey || process.env.VONAGE_API_KEY);
    if (!hasVoice && !hasSms) {
        console.warn(`[MissedCall] Clinic ${clinicId} has no voice or SMS channel configured — call logged but no recovery will be triggered.`);
    }

    // ── SMS Cooldown check ────────────────────────────────────────────────────
    // Skip SMS if same phone has an ACTIVE/RECOVERING case with SMS sent < 6h ago
    // AND no inbound reply since last SMS (patient hasn't engaged)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentActive = await prisma.missedCall.findFirst({
        where: {
            clinicId,
            fromNumber: normalizedPhone,
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
            console.info(`[Cooldown] Skipping SMS for ***${phone.slice(-4)} — active case ${recentActive.id} within 6h`);
            const missedCall = await prisma.missedCall.create({
                data: {
                    clinicId,
                    fromNumber: normalizedPhone,
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

    let aiConfig = {};
    try {
        aiConfig = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {});
    } catch {
        aiConfig = {};
    }
    const { withinHours, scheduledAt } = checkWorkingHours(
        new Date(),
        aiConfig.workingHours || null,
        clinic.timezone || 'Europe/Athens'
    );

    const missedCall = await prisma.missedCall.create({
        data: {
            clinicId,
            fromNumber: normalizedPhone,
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

    // ── Voice call (Vapi) — if enabled, call patient first ───────────────
    if (clinic.voiceEnabled) {
        console.info(`[Voice] voiceEnabled=true for clinic ${clinicId}, attempting call to ${normalizedPhone}`);
        let patientName = null;
        try {
            const existingPatient = await prisma.patient.findFirst({
                where: { clinicId, phone: normalizedPhone },
                select: { name: true }
            });
            patientName = existingPatient?.name || null;
        } catch (err) {
            console.warn('[Voice] Patient lookup failed:', err.message);
        }

        const { triggerOutboundCall } = require('./vapiService');
        const callResult = await triggerOutboundCall({
            clinic,
            phone: normalizedPhone,
            missedCallId: missedCall.id,
            patientName,
        });

        if (callResult.success) {
            console.info(`[Voice] Outbound call triggered for ***${phone.slice(-4)} — callId: ${callResult.callId} (vapi)`);
            await prisma.missedCall.update({
                where: { id: missedCall.id },
                data: {
                    smsStatus: 'pending',
                    callSid: callResult.callId,
                    aiConversation: JSON.stringify([{ role: 'system', content: `vapi_call_id:${callResult.callId}` }]),
                    totalContactAttempts: { increment: 1 }
                }
            });
            return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'pending', callId: callResult.callId, channel: 'voice', provider: 'vapi' } };
        }
        console.warn(`[Voice] Call failed (${callResult.reason}) — falling back to SMS`);
        // Attach voice failure reason to the missed call record for visibility
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsError: `voice_failed: ${callResult.reason}` }
        });
    } else {
        console.info(`[Voice] Skipped — voiceEnabled=${clinic.voiceEnabled}, vapiAssistantId=${clinic.vapiAssistantId ? 'set' : 'null'}, vapiPhoneNumberId=${clinic.vapiPhoneNumberId ? 'set' : 'null'}, apiKey=${(clinic.vapiApiKey || process.env.VAPI_API_KEY) ? 'set' : 'MISSING'}`);
    }

    // Enforce SMS limits before sending
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
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        console.error(`[MissedCall] CRITICAL: FRONTEND_URL not set! Booking links will be broken. Set FRONTEND_URL env var.`);
    }
    const bookingLink = frontendUrl
        ? `${frontendUrl}/book?clinicId=${clinicId}&missedCallId=${missedCall.id}`
        : `/book?clinicId=${clinicId}&missedCallId=${missedCall.id}`;
    
    // Default SMS with booking link
    const defaultSms = `Γεια 👋 χάσαμε την κλήση σας στο ${clinicName}.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;
    let smartSmsBody = defaultSms;
    try {
        const aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        if (aiCfg.smsInitial && aiCfg.smsInitial.trim()) {
            // Replace placeholders in custom SMS template
            smartSmsBody = aiCfg.smsInitial
                .replace('{clinic_name}', clinicName)
                .replace('{booking_link}', bookingLink);
        }
    } catch { /* use default */ }

    if (!withinHours) {
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'scheduled', scheduledSmsAt: scheduledAt } };
    }

    // Fire n8n notification non-blocking (for any automation workflows) — does NOT gate SMS delivery
    if (process.env.N8N_WEBHOOK_URL) {
        triggerN8n('/missed-call', {
            clinicId,
            missedCallId: missedCall.id,
            phone: normalizedPhone,
            smsBody: smartSmsBody,
            backendUrl: process.env.BACKEND_API_URL || '',
        });
    }

    // Send SMS directly via Twilio with atomic credit deduction + usage tracking
    const { sendSmsWithTracking } = require('./twilioService');
    const twilioResult = await sendSmsWithTracking({ to: normalizedPhone, body: smartSmsBody, clinicId });

    const finalSmsStatus = twilioResult.success ? 'sent' : 'failed';
    await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: twilioResult.success
            ? { smsStatus: 'sent', lastSmsSentAt: new Date() }
            : { smsStatus: 'failed', smsError: twilioResult.error || 'Twilio send failed' }
    });

    if (!twilioResult.success) {
        const owner = await prisma.user.findFirst({
            where: { clinicId, role: { in: ['OWNER', 'ADMIN'] } },
            select: { email: true }
        });
        if (owner?.email) {
            sendSmsFailureAlert(owner.email, clinic.name, normalizedPhone, twilioResult.error || 'Twilio send failed')
                .catch(() => {});
        }
    }

    await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: twilioResult.success ? 'QUEUED' : 'FAILED',
        providerStatusRaw: twilioResult.success ? 'twilio_sent' : 'twilio_failed',
        fromPhone: clinic.phone || null,
        toPhone: normalizedPhone,
        errorMessage: twilioResult.success ? null : (twilioResult.error || 'Twilio send failed'),
    });

    if (twilioResult.success) {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { totalContactAttempts: { increment: 1 } }
        });
    }

    return { success: true, data: { missedCallId: missedCall.id, smsStatus: finalSmsStatus, scheduledSmsAt: null } };
}

async function processScheduledMissedCalls() {
    const now = new Date();
    const due = await prisma.missedCall.findMany({
        where: { smsStatus: 'scheduled', scheduledSmsAt: { lte: now } },
        include: { clinic: true },
        take: 50
    });

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

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

        const hasAnyWebhook = !!(process.env.N8N_WEBHOOK_URL || clinic.webhookUrl || clinic.webhookMissedCall);
        if (!hasAnyWebhook) {
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
            succeeded++;
        } catch (err) {
            webhookResult = { success: false, error: err.message };
            failed++;
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

    if (processed > 0) {
        console.info(`[ScheduledSMS] Processed ${processed} scheduled SMS: ${succeeded} sent, ${failed} failed`);
    }

    return { processed, succeeded, failed };
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
        where: { id: missedCallId, clinicId },
        data: { status: 'RECOVERED', recoveredAt }
    });

    await markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt: recoveredAt });

    return { success: true, data: { missedCallId: updated.id, status: updated.status } };
}

module.exports = { handleMissedCall, processScheduledMissedCalls, retrySms, markRecovered };
