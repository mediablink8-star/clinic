const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const {
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
} = require('./recoveryTrackingService');
const { assertWithinSmsLimit } = require('./usageService');
const { sendSmsFailureAlert } = require('./emailService');
const { normalizePhone } = require('../utils/phone');

async function handleMissedCall({ phone, clinicId, callSid, bypassCooldown = false }) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new AppError('VALIDATION_ERROR', 'Invalid phone number', 400);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);

    // ── Deduplicate by callSid ──────────────────────────────────────────────
    if (callSid) {
        const existing = await prisma.missedCall.findFirst({ where: { callSid, clinicId } });
        if (existing) {
            await ensureRecoveryCaseForMissedCall(existing.id);
            return { success: true, data: { missedCallId: existing.id, duplicate: true } };
        }
    }

    // ── Opt-out check ───────────────────────────────────────────────────────
    const patient = await prisma.patient.findFirst({
        where: { clinicId, phone: normalizedPhone },
        select: { optedOut: true }
    });
    if (patient?.optedOut) {
        console.info(`[MissedCall] Skipping opted-out patient ***${normalizedPhone.slice(-4)}`);
        return { success: true, data: { skipped: true, reason: 'opted_out' } };
    }

    // ── 6-hour cooldown ─────────────────────────────────────────────────────
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentActive = await prisma.missedCall.findFirst({
        where: {
            clinicId,
            fromNumber: normalizedPhone,
            status: { in: ['DETECTED', 'RECOVERING'] },
            lastSmsSentAt: { gte: sixHoursAgo },
        },
        orderBy: { lastSmsSentAt: 'desc' },
    });

    if (recentActive && !bypassCooldown) {
        console.info(`[Cooldown] Skipping SMS for ***${normalizedPhone.slice(-4)} — active case ${recentActive.id} within 6h`);
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

    // ── Working hours check ─────────────────────────────────────────────────
    const { checkWorkingHours } = require('./workingHours');
    let aiConfig = {};
    try {
        aiConfig = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {});
    } catch { aiConfig = {}; }

    const { withinHours, scheduledAt } = checkWorkingHours(
        new Date(),
        aiConfig.workingHours || null,
        clinic.timezone || 'Europe/Athens'
    );

    // ── Create MissedCall record ────────────────────────────────────────────
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

    // ── Voice call (Vapi) — if enabled, call patient first ──────────────────
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
            console.info(`[Voice] Outbound call triggered for ***${normalizedPhone.slice(-4)} — callId: ${callResult.callId}`);
            await prisma.missedCall.update({
                where: { id: missedCall.id },
                data: {
                    smsStatus: 'pending',
                    callSid: callResult.callId,
                    totalContactAttempts: { increment: 1 }
                }
            });
            return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'pending', callId: callResult.callId, channel: 'voice', provider: 'vapi' } };
        }
        console.warn(`[Voice] Call failed (${callResult.reason}) — falling back to SMS`);
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsError: `voice_failed: ${callResult.reason}` }
        });
    } else {
        console.info(`[Voice] Skipped — voiceEnabled=${clinic.voiceEnabled}`);
    }

    // ── Enforce SMS limits ──────────────────────────────────────────────────
    try {
        await assertWithinSmsLimit(clinicId);
    } catch (limitErr) {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsStatus: 'failed', smsError: limitErr.code || 'Usage limit reached' }
        });
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'failed', reason: 'limit_reached' } };
    }

    // ── Outside hours → schedule SMS ────────────────────────────────────────
    if (!withinHours) {
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'scheduled', scheduledSmsAt } };
    }

    // ── Build SMS body ──────────────────────────────────────────────────────
    const clinicName = clinic.name || 'το ιατρείο';
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
        console.error(`[MissedCall] CRITICAL: FRONTEND_URL not set!`);
    }
    const bookingLink = frontendUrl
        ? `${frontendUrl}/book?clinicId=${clinicId}&missedCallId=${missedCall.id}`
        : `/book?clinicId=${clinicId}&missedCallId=${missedCall.id}`;

    const defaultSms = `Γεια 👋 χάσαμε την κλήση σας στο ${clinicName}.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;
    let smsBody = defaultSms;
    try {
        if (aiConfig.smsInitial && aiConfig.smsInitial.trim()) {
            smsBody = aiConfig.smsInitial
                .replace('{clinic_name}', clinicName)
                .replace('{booking_link}', bookingLink);
        }
    } catch { /* use default */ }

    // ── Send SMS via Twilio ─────────────────────────────────────────────────
    const { sendSmsWithTracking } = require('./twilioService');
    const twilioResult = await sendSmsWithTracking({ to: normalizedPhone, body: smsBody, clinicId });

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
        if (!clinic || !clinic.isActive) continue;

        await ensureRecoveryCaseForMissedCall(mc.id);

        await prisma.missedCall.updateMany({
            where: { id: mc.id, smsStatus: 'scheduled' },
            data: { smsStatus: 'processing' }
        });

        const clinicName = clinic.name || 'το ιατρείο';
        const frontendUrl = process.env.FRONTEND_URL;
        const bookingLink = frontendUrl
            ? `${frontendUrl}/book?clinicId=${mc.clinicId}&missedCallId=${mc.id}`
            : `/book?clinicId=${mc.clinicId}&missedCallId=${mc.id}`;

        let smsBody = `Γεια 👋 χάσαμε την κλήση σας στο ${clinicName}.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;
        try {
            const aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
            if (aiCfg.smsInitial && aiCfg.smsInitial.trim()) {
                smsBody = aiCfg.smsInitial
                    .replace('{clinic_name}', clinicName)
                    .replace('{booking_link}', bookingLink);
            }
        } catch { /* use default */ }

        const { sendSmsWithTracking } = require('./twilioService');
        const twilioResult = await sendSmsWithTracking({ to: mc.fromNumber, body: smsBody, clinicId: mc.clinicId });

        if (twilioResult.success) {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { smsStatus: 'sent', lastSmsSentAt: new Date() }
            });
            succeeded++;
        } else {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { smsStatus: 'failed', smsError: twilioResult.error || 'Twilio send failed' }
            });
            failed++;
        }

        await recordOutboundMessageForMissedCall({
            missedCallId: mc.id,
            status: twilioResult.success ? 'QUEUED' : 'FAILED',
            providerStatusRaw: twilioResult.success ? 'twilio_sent' : 'twilio_failed',
            fromPhone: clinic.phone || null,
            toPhone: mc.fromNumber,
            errorMessage: twilioResult.success ? null : (twilioResult.error || 'Twilio send failed'),
        });

        processed++;
    }

    if (processed > 0) {
        console.info(`[ScheduledSMS] Processed ${processed}: ${succeeded} sent, ${failed} failed`);
    }

    return { processed, succeeded, failed };
}

module.exports = { handleMissedCall, processScheduledMissedCalls };
