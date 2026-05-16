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
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');
const { handleMissedCall } = require('../services/missedCallService');
const { markRecoveryCaseRecovered, ensureRecoveryCaseForMissedCall } = require('../services/recoveryTrackingService');
const { triggerSmsFallback } = require('../services/smsFallbackService');
const { createAppointment } = require('../services/appointmentService');

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
    const greekDays = {
        'δευτέρα': 1, 'τριτη': 2, 'τρίτη': 2, 'τεταρτη': 3, 'τετάρτη': 3,
        'πεμπτη': 4, 'πέμπτη': 4, 'παρασκευη': 5, 'παρασκευή': 5,
        'σαββατο': 6, 'σάββατο': 6, 'κυριακη': 0, 'κυριακή': 0,
    };
    for (const [name, wd] of Object.entries(greekDays)) {
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
    const vapiSecret = process.env.VAPI_WEBHOOK_SECRET || process.env.VAPI_API_KEY;
    if (!vapiSecret) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError('CONFIGURATION_ERROR', 'Vapi webhook authentication not configured', 500);
        }
        console.warn('[Vapi] WARNING: No VAPI_WEBHOOK_SECRET set — running unauthenticated in dev');
        return next();
    }
    const provided = req.headers['x-vapi-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!provided || provided !== vapiSecret) {
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
    const callId = event.id;
    const status = event.status;

    console.info(`[Vapi] Webhook: status=${status} callId=${callId}`);

    res.json({ success: true });

    setImmediate(() => handleVapiEvent(event).catch(err =>
        console.error('[Vapi] handleVapiEvent error:', err.message)
    ));
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
    console.info(`[Vapi] Tool call: ${fn} callId=${call_id}`, input);

    const mc = await prisma.missedCall.findFirst({
        where: { callSid: call_id },
        include: { clinic: true }
    });

    if (!mc) {
        console.warn(`[Vapi] Tool call — no missed call for callId=${call_id}`);
        return res.json({ success: false, message: 'Case not found' });
    }

    if (fn === 'book_appointment') {
        await handleVoiceBooking(mc, input);
        return res.json({ success: true, message: `Ραντεβού καταχωρήθηκε.` });
    }

    if (fn === 'request_callback') {
        await handleVoiceCallback(mc);
        return res.json({ success: true, message: 'Αίτημα επανάκλησης καταχωρήθηκε.' });
    }

    res.json({ success: false, message: 'Unknown tool' });
}));

async function handleVapiEvent(event) {
    const { id: call_id, status, metadata, summary } = event;
    console.info(`[Vapi] Processing: status=${status} callId=${call_id}`);

    const missedCallId = metadata?.missedCallId;
    const mc = missedCallId
        ? await prisma.missedCall.findUnique({ where: { id: missedCallId }, include: { clinic: true } })
        : await prisma.missedCall.findFirst({ where: { callSid: call_id }, include: { clinic: true } });

    if (!mc) {
        console.warn(`[Vapi] No missed call for callId=${call_id}`);
        return;
    }

    // Call ended
    if (status === 'ended' || status === 'completed') {
        const wasBooked = mc.status === 'RECOVERED';

        console.info(`[Vapi] Call ended: callId=${call_id} booked=${wasBooked}`);

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                status: wasBooked ? 'RECOVERED' : 'RECOVERING',
                smsStatus: wasBooked ? 'sent' : mc.smsStatus,
                ...(summary && { aiConversation: JSON.stringify([{ role: 'system', content: summary }]) }),
            }
        });

        if (!wasBooked) {
            const clinic = mc.clinic;
            if (clinic) {
                const bookingLink = `${process.env.FRONTEND_URL || 'https://clinicflow.app'}/book?clinicId=${clinic.id}&missedCallId=${mc.id}`;
                const smsBody = `Σας καλέσαμε από το ${clinic.name || 'το ιατρείο'} αλλά δεν απαντήσατε.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;
                console.info(`[Vapi] SMS fallback → ${mc.fromNumber}`);
                await triggerSmsFallback(clinic, mc.fromNumber, smsBody, mc.id);
            }
        }
    }
}

async function handleVoiceBooking(mc, input) {
    const { patient_name, preferred_day, preferred_time } = input;
    console.info(`[Vapi] Booking via voice: ${patient_name} — ${preferred_day} ${preferred_time}`);

    const clinic = mc.clinic;

    let patient = null;
    try {
        patient = await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinic.id, phone: mc.fromNumber } },
            update: patient_name ? { name: patient_name } : {},
            create: { clinicId: clinic.id, name: patient_name || mc.fromNumber, phone: mc.fromNumber },
        });
    } catch (err) {
        console.warn('[Vapi] Patient upsert failed:', err.message);
    }

    // Use full parseAppointmentDay for proper Greek day name support
    let startTime = parseAppointmentDay(preferred_day || 'αύριο');
    if (!startTime) {
        startTime = new Date();
        startTime.setDate(startTime.getDate() + 1);
    }
    startTime.setHours(9, 0, 0, 0);

    try {
        const timeStr = (preferred_time || '').toLowerCase();
        const digitMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?/);
        if (digitMatch) {
            const hour = parseInt(digitMatch[1]);
            const min = parseInt(digitMatch[2] || '0');
            startTime.setHours(hour, min, 0, 0);
        }
    } catch {}

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    let booked = false;
    if (patient) {
        try {
            // Use createAppointment to enforce working hours, conflict detection, and audit logging
            await createAppointment(
                {
                    clinicId: clinic.id,
                    patientId: patient.id,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    reason: 'Ραντεβού από AI φωνητική ανάκτηση',
                    notes: `Ημέρα: ${preferred_day} | Ώρα: ${preferred_time}`,
                    priority: 'NORMAL',
                },
                { userId: null, ip: null }
            );
            console.info(`[Vapi] Appointment created via appointmentService`);
            booked = true;
        } catch (err) {
            console.warn('[Vapi] Appointment create failed:', err.message);
            // Send SMS fallback with booking link so patient can self-book
            const bookingLink = `${process.env.FRONTEND_URL || 'https://clinicflow.app'}/book?clinicId=${clinic.id}&missedCallId=${mc.id}`;
            const smsBody = `Δεν μπορέσαμε να κλείσουμε το ραντεβού για ${preferred_day} στις ${preferred_time} (εκτός ωραρίου ή μη διαθέσιμη ώρα).\nΚλείστε εδώ: ${bookingLink}`;
            await triggerSmsFallback(clinic, mc.fromNumber, smsBody, mc.id).catch(() => {});
        }
    }

    if (booked) {
        const recoveredAt = new Date();
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                status: 'RECOVERED',
                recoveredAt,
                conversationState: 'COMPLETED',
                smsStatus: 'sent',
                patientId: patient?.id || null,
                estimatedRevenue: mc.estimatedRevenue > 0 ? mc.estimatedRevenue : 80,
            }
        });

        try {
            await ensureRecoveryCaseForMissedCall(mc.id);
            await markRecoveryCaseRecovered({ clinicId: mc.clinicId, missedCallId: mc.id, occurredAt: recoveredAt });
        } catch (err) {
            console.warn('[Vapi] markRecoveryCaseRecovered failed:', err.message);
        }

        console.info(`[Vapi] Case RECOVERED: ${mc.id}`);
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
    console.info(`[Vapi] Booking not completed, case remains RECOVERING: ${mc.id}`);
}

async function handleVoiceCallback(mc) {
    console.info(`[Vapi] Callback requested`);
    await prisma.missedCall.update({
        where: { id: mc.id },
        data: { conversationState: 'CALLBACK', status: 'RECOVERING' }
    });
}

module.exports = router;