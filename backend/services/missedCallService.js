const prisma = require('./prisma');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const AppError = require('../errors/AppError');
const {
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
} = require('./recoveryTrackingService');
const { assertWithinSmsLimit } = require('./usageService');
const { sendSmsFailureAlert } = require('./emailService');
const { normalizePhone } = require('../utils/phone');
const { getBookingLink, processTemplate } = require('../utils/url');
const logger = require('../utils/logger');

async function handleMissedCall({ phone, clinicId, callSid, bypassCooldown = false, isSilent = false, force = false }) {
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) throw new AppError('VALIDATION_ERROR', 'Invalid phone number', 400);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);

    // ── Deduplicate by callSid ──────────────────────────────────────────────
    // Normal case: NOTIFY_START pre-tracks the call, NOTIFY_END must actually run recovery.
    // `force: true` means "this is a follow-up event for the same call, continue the work".
    let existing = null;
    if (callSid) {
        existing = await prisma.missedCall.findFirst({ where: { callSid, clinicId } });
        if (existing) {
            if (force) {
                const terminal = ['sent', 'failed', 'scheduled', 'skipped'];
                if (terminal.includes(existing.smsStatus)) {
                    logger.info('MissedCall recovery already finalised', { callSid, smsStatus: existing.smsStatus, missedCallId: existing.id });
                    return { success: true, data: { missedCallId: existing.id, duplicate: true, reason: `already_${existing.smsStatus}` } };
                }
                logger.info('MissedCall force-continuing recovery', { callSid, missedCallId: existing.id, currentStatus: existing.status, currentSmsStatus: existing.smsStatus });
            } else {
                await ensureRecoveryCaseForMissedCall(existing.id);
                return { success: true, data: { missedCallId: existing.id, duplicate: true } };
            }
        }
    }

    // ── Opt-out check + link existing patient ──────────────────────────────
    const patient = await prisma.patient.findFirst({
        where: { clinicId, phone: normalizedPhone },
        select: { id: true, optedOut: true }
    });
    const patientId = patient?.id || null;
    if (patient?.optedOut) {
        logger.info('Skipping opted-out patient', { phoneTail: normalizedPhone.slice(-4) });
        if (existing) {
            await prisma.missedCall.update({
                where: { id: existing.id },
                data: { smsStatus: 'skipped', smsError: 'opted_out', patientId }
            });
        }
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
        logger.info('Skipping recovery — cooldown active', { phoneTail: normalizedPhone.slice(-4), caseId: recentActive.id });
        if (existing) {
            await prisma.missedCall.update({
                where: { id: existing.id },
                data: { smsStatus: 'skipped', smsError: 'Cooldown — active case within 6h', patientId }
            });
            await ensureRecoveryCaseForMissedCall(existing.id);
            return { success: true, data: { missedCallId: existing.id, smsStatus: 'skipped', reason: 'cooldown' } };
        }
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
                patientId,
            }
        });
        await ensureRecoveryCaseForMissedCall(missedCall.id);
        return { success: true, data: { missedCallId: missedCall.id, smsStatus: 'skipped', reason: 'cooldown' } };
    }

    // ── Working hours + holiday check ───────────────────────────────────────
    const { checkClinicAvailability } = require('./workingHours');
    let aiConfig = {};
    try {
        aiConfig = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic.aiConfig || {});
    } catch { aiConfig = {}; }

    const { withinHours, scheduledAt, reason: availReason, holiday } = await checkClinicAvailability(
        new Date(),
        aiConfig.workingHours || null,
        clinic.timezone || DEFAULT_TIMEZONE
    );

    // ── Create or update MissedCall record ──────────────────────────────────
    const estimatedRevenue = (() => {
        try {
            const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
            return parseFloat(ai.avgAppointmentValue) || 80;
        } catch { return 80; }
    })();

    let missedCall;
    if (existing) {
        missedCall = await prisma.missedCall.update({
            where: { id: existing.id },
            data: {
                status: 'RECOVERING',
                smsStatus: withinHours ? 'pending' : 'scheduled',
                scheduledSmsAt: withinHours ? null : scheduledAt,
                patientId,
            }
        });
    } else {
        missedCall = await prisma.missedCall.create({
            data: {
                clinicId,
                fromNumber: normalizedPhone,
                callSid: callSid || null,
                status: 'RECOVERING',
                smsStatus: withinHours ? 'pending' : 'scheduled',
                scheduledSmsAt: withinHours ? null : scheduledAt,
                estimatedRevenue,
                patientId,
            }
        });
    }

    await ensureRecoveryCaseForMissedCall(missedCall.id);

    if (isSilent) {
        return { success: true, data: { missedCallId: missedCall.id, status: 'SILENT_TRACKING' } };
    }

    // ── Voice call (Vapi) — REMOVED ─────────────────────────────────────────
    // Vapi is now triggered externally by Zadarma via SIP trunk. Our backend
    // does not call Vapi directly. Vapi's webhook (POST /api/vapi/tool) updates
    // the MissedCall when the AI books an appointment.

    // ── Outside hours → schedule SMS ────────────────────────────────────────
    if (!withinHours) {
        const reasonNote = availReason === 'holiday' && holiday
            ? `holiday:${holiday.name}`
            : 'off-hours';
        return {
            success: true,
            data: {
                missedCallId: missedCall.id,
                smsStatus: 'scheduled',
                scheduledSmsAt,
                reason: reasonNote
            }
        };
    }

    // ── Build SMS body ──────────────────────────────────────────────────────
    const clinicName = clinic.name || 'το ιατρείο';
    const bookingLink = getBookingLink(clinicId, missedCall.id);

    const defaultSms = `Γεια χάσαμε την κλήση σας στο ${clinicName}.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;

    let smsBody = defaultSms;
    try {
        if (aiConfig.smsInitial && aiConfig.smsInitial.trim()) {
            smsBody = processTemplate(aiConfig.smsInitial, {
                clinic_name: clinicName,
                booking_link: bookingLink
            });
        }
    } catch { /* use default */ }

    // ── Send SMS via Twilio (this is the initial recovery SMS) ─────────────
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
                .catch(err => logger.error('MissedCall SMS failure alert email failed', { err }));
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

        const claim = await prisma.missedCall.updateMany({
            where: { id: mc.id, smsStatus: 'scheduled' },
            data: { smsStatus: 'processing' }
        });
        if (claim.count === 0) continue;

        const clinicName = clinic.name || 'το ιατρείο';
        const bookingLink = getBookingLink(mc.clinicId, mc.id);

        let smsBody = `Γεια χάσαμε την κλήση σας στο ${clinicName}.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;

        try {
            const aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
            if (aiCfg.smsInitial && aiCfg.smsInitial.trim()) {
                smsBody = processTemplate(aiCfg.smsInitial, {
                    clinic_name: clinicName,
                    booking_link: bookingLink
                });
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
        logger.info('ScheduledSMS Processed', { processed, succeeded, failed });
    }

    return { processed, succeeded, failed };
}

module.exports = { handleMissedCall, processScheduledMissedCalls };
