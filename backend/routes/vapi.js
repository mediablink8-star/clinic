/**
 * Vapi AI Webhook Handler
 * 
 * Receives events from Vapi AI:
 * - call.answered — outbound call connected
 * - call.ended — call finished, determine if SMS fallback needed
 * - tool_call — AI wants to book appointment or request callback
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const { GREEK_DAY_MAP, DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const prisma = require('../services/prisma');
const { handleMissedCall } = require('../services/missedCallService');
const { markRecoveryCaseRecovered, ensureRecoveryCaseForMissedCall } = require('../services/recoveryTrackingService');
const { triggerSmsFallback } = require('../services/smsFallbackService');
const { createAppointment } = require('../services/appointmentService');
const { getBookingLink } = require('../utils/url');
const { normalizePhone } = require('../utils/phone');
const logger = require('../utils/logger');
const { fromZonedTime } = require('date-fns-tz');
const { connection: redis } = require('../services/queueService');
const { recordDelivery } = require('../services/webhookService');

// Redis may be disabled in some environments (e.g., dev without Redis)
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true' || !redis;

function parseAppointmentDay(dayStr) {
    const now = new Date();
    const lower = (dayStr || '').toLowerCase().trim();
    if (lower.includes('αύριο') || lower.includes('tomorrow')) {
        now.setDate(now.getDate() + 1);
        return now;
    }
    if (lower.includes('μεθαύριο')) {
        now.setDate(now.getDate() + 2);
        return now;
    }
    for (const [name, wd] of Object.entries(GREEK_DAY_MAP)) {
        if (lower.includes(name)) {
            const diff = (wd - now.getDay() + 7) % 7 || 7;
            now.setDate(now.getDate() + diff);
            return now;
        }
    }
    return null;
}

// Shared secret check for Vapi webhooks
function vapiAuth(req, res, next) {
    const vapiSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (!vapiSecret) {
        if (process.env.NODE_ENV === 'production') {
            logger.error('[Vapi] VAPI_WEBHOOK_SECRET not set — refusing all webhook requests in production');
            throw new AppError('CONFIGURATION_ERROR', 'Webhook secret not configured', 500);
        }
        logger.warn('[Vapi] VAPI_WEBHOOK_SECRET not set — webhook is unauthenticated (dev only).');
        return next();
    }
    const provided = req.headers['x-vapi-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!provided) {
        logger.warn('[Vapi] No secret header on incoming webhook — rejecting');
        throw new AppError('UNAUTHORIZED', 'Missing webhook secret', 401);
    }
    // Timing-safe comparison to prevent timing attacks
    const providedBuffer = Buffer.from(provided, 'utf8');
    const secretBuffer = Buffer.from(vapiSecret, 'utf8');
    if (providedBuffer.length !== secretBuffer.length || !crypto.timingSafeEqual(providedBuffer, secretBuffer)) {
        throw new AppError('UNAUTHORIZED', 'Unauthorized', 401);
    }
    next();
}

/**
 * POST /api/vapi/webhook
 * Main webhook from Vapi AI
 */
router.post('/webhook', vapiAuth, asyncHandler(async (req, res) => {
    const event = req.body;
    const callId = event.id || event.call?.id;
    const eventType = event.type || event.message?.type || event.status || 'unknown';

    logger.info('Vapi Webhook Received', { status: event.status, callId, eventType });

    // Idempotency: dedupe Vapi webhook retries by callId + eventType
    // A single call fires multiple distinct events (call-started, function-call, call-ended, transcript)
    // all sharing the same callId — key by both to avoid swallowing real events.
    if (redis && !REDIS_DISABLED && callId) {
        const idempotencyKey = `vapi:webhook:${callId}:${eventType}`;
        const alreadyProcessed = await redis.set(idempotencyKey, '1', 'EX', 86400, 'NX'); // 24h TTL, only if not exists
        if (!alreadyProcessed) {
            logger.info('Vapi webhook duplicate ignored', { callId, eventType });
            return res.json({ success: true, duplicate: true });
        }
    }

    // Process BEFORE responding — if processing fails, return 500 so Vapi retries.
    // Responding 200 before processing means failures are silently lost.
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            await handleVapiEvent(event);
            // Log successful webhook processing
            const missedCallId = event.metadata?.missedCallId;
            let clinicId = null;
            if (missedCallId) {
                const mc = await prisma.missedCall.findUnique({ where: { id: missedCallId }, select: { clinicId: true } });
                clinicId = mc?.clinicId || null;
            }
            if (clinicId) {
                await recordDelivery({
                    clinicId,
                    eventType: `vapi.webhook.${eventType}`,
                    targetUrl: process.env.BACKEND_API_URL + '/api/vapi/webhook',
                    success: true,
                    attempts: 1,
                    httpStatus: 200,
                    errorMessage: null,
                    durationMs: null,
                    payload: { callId, eventType, status: event.status, missedCallId },
                });
            }
            return res.json({ success: true });
        } catch (err) {
            logger.error(`Vapi handleVapiEvent error (attempt ${attempt}/${MAX_RETRIES})`, { err, callId, eventType });
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    // All retries exhausted — return 500 so Vapi will retry later
    // Log to WebhookDelivery for dead-letter visibility
    const missedCallId = event.metadata?.missedCallId;
    let clinicId = null;
    if (missedCallId) {
        const mc = await prisma.missedCall.findUnique({ where: { id: missedCallId }, select: { clinicId: true } });
        clinicId = mc?.clinicId || null;
    }
    if (clinicId) {
        await recordDelivery({
            clinicId,
            eventType: `vapi.webhook.${eventType}`,
            targetUrl: process.env.BACKEND_API_URL + '/api/vapi/webhook',
            success: false,
            attempts: MAX_RETRIES,
            httpStatus: 500,
            errorMessage: 'All retries exhausted',
            durationMs: null,
            payload: { callId, eventType, status: event.status, missedCallId },
        });
    }
    res.status(500).json({ error: 'Webhook processing failed' });
}));

/**
 * POST /api/vapi/tool
 * Called by Vapi AI when the agent invokes a tool (book_appointment, request_callback)
 */
router.post('/tool', vapiAuth, asyncHandler(async (req, res) => {
    const { function: fn, arguments: args, call_id } = req.body;
    let input = args;
    if (typeof args === 'string') {
        try {
            input = JSON.parse(args);
        } catch {
            return res.status(400).json({ success: false, message: 'Invalid tool arguments payload' });
        }
    }
    if (!input || typeof input !== 'object') {
        throw new AppError('VALIDATION_ERROR', 'Missing tool arguments', 400);
    }
    logger.info(`Vapi Tool call: ${fn}`, { callId: call_id, input });

    // Idempotency for tool calls (Vapi may retry)
    if (redis && !REDIS_DISABLED && call_id) {
        const toolIdempotencyKey = `vapi:tool:${call_id}:${fn}:${JSON.stringify(input)}`;
        const alreadyProcessed = await redis.set(toolIdempotencyKey, '1', 'EX', 86400, 'NX');
        if (!alreadyProcessed) {
            logger.info('Vapi tool call duplicate — already processed', { callId: call_id, fn });
            return res.json({ success: true, duplicate: true });
        }
    }

    const mc = await prisma.missedCall.findFirst({
        where: { callSid: call_id },
        include: { clinic: true }
    });

    if (!mc) {
        logger.warn('Vapi tool call — no missed call', { callId: call_id });
        return res.json({ success: false, message: 'Case not found' });
    }

    try {
        if (fn === 'book_appointment') {
            await handleVoiceBooking(mc, input);
            // Log successful tool call
            if (mc.clinicId) {
                await recordDelivery({
                    clinicId: mc.clinicId,
                    eventType: `vapi.tool.${fn}`,
                    targetUrl: process.env.BACKEND_API_URL + '/api/vapi/tool',
                    success: true,
                    attempts: 1,
                    httpStatus: 200,
                    errorMessage: null,
                    durationMs: null,
                    payload: { callId: call_id, fn, input },
                });
            }
            return res.json({ success: true, message: `Ραντεβού καταχωρήθηκε.` });
        }

        if (fn === 'request_callback') {
            await handleVoiceCallback(mc);
            if (mc.clinicId) {
                await recordDelivery({
                    clinicId: mc.clinicId,
                    eventType: `vapi.tool.${fn}`,
                    targetUrl: process.env.BACKEND_API_URL + '/api/vapi/tool',
                    success: true,
                    attempts: 1,
                    httpStatus: 200,
                    errorMessage: null,
                    durationMs: null,
                    payload: { callId: call_id, fn, input },
                });
            }
            return res.json({ success: true, message: 'Αίτημα επανάκλησης καταχωρήθηκε.' });
        }

        res.json({ success: false, message: 'Unknown tool' });
    } catch (err) {
        logger.error(`Vapi tool ${fn} failed`, { err, callId: call_id, fn, input });
        // Log failed tool call for dead-letter visibility
        if (mc?.clinicId) {
            await recordDelivery({
                clinicId: mc.clinicId,
                eventType: `vapi.tool.${fn}`,
                targetUrl: process.env.BACKEND_API_URL + '/api/vapi/tool',
                success: false,
                attempts: 1,
                httpStatus: 500,
                errorMessage: err.message,
                durationMs: null,
                payload: { callId: call_id, fn, input },
            });
        }
        throw err;
    }
}));

async function handleVapiEvent(event) {
    const { id: call_id, status, metadata, summary } = event;
    logger.info('Vapi processing event', { status, callId: call_id });

    const missedCallId = metadata?.missedCallId;
    const mc = missedCallId
        ? await prisma.missedCall.findUnique({ where: { id: missedCallId }, include: { clinic: true } })
        : await prisma.missedCall.findFirst({ where: { callSid: call_id }, include: { clinic: true } });

    if (!mc) {
        const fromPhone = normalizePhone(event.customer?.number || event.call?.customer?.number);
        const toPhone = normalizePhone(event.phoneNumber?.number || event.call?.phoneNumber?.number);
        
        if (fromPhone && toPhone) {
            logger.info('Vapi mc not found by ID, searching by phone', { fromPhone, toPhone });
            // Find clinic by the 'to' number (the zadarma/vapi number)
            const clinic = await prisma.clinic.findFirst({
                where: {
                    OR: [
                        { zadarmaPhoneNumber: toPhone },
                        { phone: toPhone }
                    ]
                }
            });
            
            if (clinic) {
                // Find recent recovering case for this patient in this clinic
                const recent = await prisma.missedCall.findFirst({
                    where: { 
                        clinicId: clinic.id, 
                        fromNumber: fromPhone,
                        status: 'RECOVERING'
                    },
                    orderBy: { createdAt: 'desc' },
                    include: { clinic: true }
                });
                if (recent) {
                    logger.info('Vapi found mc by phone lookup', { missedCallId: recent.id });
                    // Update the mc with the vapi call id for future lookups
                    await prisma.missedCall.update({
                        where: { id: recent.id },
                        data: { callSid: call_id }
                    });
                    return await handleVapiEvent({ ...event, metadata: { ...metadata, missedCallId: recent.id } });
                }
            }
        }
        
        logger.warn('Vapi no missed call for event after phone fallback', { callId: call_id });
        return;
    }

    // Call ended
    if (status === 'ended' || status === 'completed') {
        const wasBooked = mc.status === 'RECOVERED';

        logger.info('Vapi call ended', { callId: call_id, booked: wasBooked });

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                status: wasBooked ? 'RECOVERED' : 'RECOVERING',
                smsStatus: wasBooked ? 'sent' : mc.smsStatus,
                ...(summary && { aiConversation: JSON.stringify([{ role: 'system', content: summary }]) }),
            }
        });

        if (!wasBooked) {
            // Only send a follow-up SMS if the initial recovery SMS wasn't already sent
            // by handleMissedCall (which fires on Zadarma NOTIFY_END with disposition=missed).
            // If the patient reached Vapi, NOTIFY_END with disposition=answered was sent
            // and handleMissedCall was NOT called, so we need this SMS to give them the link.
            const terminalSmsStatuses = ['sent', 'failed', 'scheduled', 'skipped'];
            if (!terminalSmsStatuses.includes(mc.smsStatus)) {
                const clinic = mc.clinic;
                if (clinic) {
                    const bookingLink = getBookingLink(clinic.id, mc.id);
                    const smsBody = `Το ιατρείο ${clinic.name || 'μας'} δεν μπόρεσε να ολοκληρώσει την κλήση σας.\nΚλείστε το ραντεβού σας άμεσα εδώ: ${bookingLink}`;
                    logger.info('Vapi call ended without booking, sending booking-link SMS', { callId: call_id, phoneTail: mc.fromNumber.slice(-4) });
                    await triggerSmsFallback(clinic, mc.fromNumber, smsBody, mc.id);
                }
            } else {
                logger.info('Vapi call ended without booking, initial SMS already handled', { callId: call_id, smsStatus: mc.smsStatus });
            }
        }
    }
}

async function handleVoiceBooking(mc, input) {
    const { patient_name, preferred_day, preferred_time } = input;
    logger.info('Vapi booking via voice', { patientName: patient_name, day: preferred_day, time: preferred_time });

    const clinic = mc.clinic;

    let patient = null;
    try {
        patient = await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinic.id, phone: mc.fromNumber } },
            update: patient_name ? { name: patient_name } : {},
            create: { clinicId: clinic.id, name: patient_name || mc.fromNumber, phone: mc.fromNumber },
        });
    } catch (err) {
        logger.warn('Vapi patient upsert failed', { err });
    }

    // Use full parseAppointmentDay for proper Greek day name support
    let startTime = parseAppointmentDay(preferred_day || 'αύριο');
    if (!startTime) {
        startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);
    }

    const clinicTimezone = clinic.timezone || DEFAULT_TIMEZONE;
    let hour = 9;
    let min = 0;

    try {
        const timeStr = (preferred_time || '').toLowerCase();
        const digitMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?/);
        if (digitMatch) {
            hour = parseInt(digitMatch[1]);
            min = parseInt(digitMatch[2] || '0');
        }
    } catch {}

    const dateStr = startTime.toISOString().split('T')[0];
    startTime = fromZonedTime(
        `${dateStr} ${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`,
        clinicTimezone
    );

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    let booked = false;
    let appointmentId = null;
    if (patient) {
        try {
            const aptResult = await createAppointment(
                {
                    clinicId: clinic.id,
                    patientId: patient.id,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    reason: 'Ραντεβού από AI φωνητική ανάκτηση',
                    notes: `Ημέρα: ${preferred_day} | Ώρα: ${preferred_time}`,
                    priority: 'NORMAL',
                    source: 'AI_VOICE',
                },
                { userId: 'vapi-ai', ip: '127.0.0.1' }
            );
            const appointmentId = aptResult?.data?.id || null;
            logger.info('Vapi appointment created', { appointmentId });
            booked = true;

            // Record both event types so dashboard revenue + activity feed update
            const revenue = mc?.estimatedRevenue > 0 ? mc.estimatedRevenue : 80;
            await Promise.allSettled([
                prisma.feedEvent.create({
                    data: {
                        clinicId: clinic.id,
                        type: 'APPOINTMENT_BOOKED_VIA_CALL',
                        title: 'Ραντεβού από AI φωνητική κλήση',
                        patientName: patient?.name || null,
                        phone: mc?.fromNumber || null,
                        appointmentId,
                        metadata: { estimatedRevenue: revenue },
                    }
                }),
                prisma.feedEvent.create({
                    data: {
                        clinicId: clinic.id,
                        type: 'AI_CALL_ANSWERED',
                        title: 'AI κλήση απαντήθηκε — κλείστηκε ραντεβού',
                        patientName: patient?.name || null,
                        phone: mc?.fromNumber || null,
                        appointmentId,
                        metadata: { estimatedRevenue: revenue },
                    }
                }),
            ]);
        } catch (err) {
            logger.warn('Vapi appointment create failed', { err });
            // Send SMS fallback with booking link so patient can self-book
            const bookingLink = getBookingLink(clinic.id, mc.id);
            const smsBody = `Δεν μπορέσαμε να κλείσουμε το ραντεβού για ${preferred_day} στις ${preferred_time} (εκτός ωραρίου ή μη διαθέσιμη ώρα).\nΚλείστε εδώ: ${bookingLink}`;
            await triggerSmsFallback(clinic, mc.fromNumber, smsBody, mc.id).catch(err =>
                logger.error('Vapi SMS fallback failed', { missedCallId: mc.id, err })
            );
        }
    }

    if (booked) {
        const recoveredAt = new Date();
        const revenue = mc.estimatedRevenue > 0 ? mc.estimatedRevenue : 80;
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                status: 'RECOVERED',
                recoveredAt,
                conversationState: 'COMPLETED',
                smsStatus: 'sent',
                patientId: patient?.id || null,
                estimatedRevenue: revenue,
                appointmentId: appointmentId || mc.appointmentId || null,
            }
        });

        try {
            await ensureRecoveryCaseForMissedCall(mc.id);
            await markRecoveryCaseRecovered({ clinicId: mc.clinicId, missedCallId: mc.id, occurredAt: recoveredAt });
        } catch (err) {
            logger.warn('Vapi markRecoveryCaseRecovered failed', { err });
        }

        logger.info('Vapi case RECOVERED', { missedCallId: mc.id, appointmentId, revenue });
        return;
    }

    await prisma.missedCall.update({
        where: { id: mc.id },
        data: {
            status: 'RECOVERING',
            conversationState: 'ACTIVE',
            patientId: patient?.id || mc.patientId || null,
        }
    });
    logger.info('Vapi booking not completed, case remains RECOVERING', { missedCallId: mc.id });
}

async function handleVoiceCallback(mc) {
    logger.info('Vapi callback requested');
    await prisma.missedCall.update({
        where: { id: mc.id },
        data: { conversationState: 'CALLBACK', status: 'RECOVERING' }
    });
}

module.exports = router;