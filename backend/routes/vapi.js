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
const prisma = require('../services/prisma');
const { handleMissedCall } = require('../services/missedCallService');
const { markRecoveryCaseRecovered, ensureRecoveryCaseForMissedCall } = require('../services/recoveryTrackingService');
const { triggerN8nSms } = require('../services/smsFallbackService');

/**
 * POST /api/vapi/webhook
 * Main webhook from Vapi AI
 */
router.post('/webhook', asyncHandler(async (req, res) => {
    const event = req.body;
    const callId = event.id;
    const status = event.status;

    console.log(`[Vapi] Webhook: status=${status} callId=${callId}`);

    res.json({ success: true });

    setImmediate(() => handleVapiEvent(event).catch(err =>
        console.error('[Vapi] handleVapiEvent error:', err.message)
    ));
}));

/**
 * POST /api/vapi/tool
 * Called by Vapi AI when the agent invokes a tool (book_appointment, request_callback)
 */
router.post('/tool', asyncHandler(async (req, res) => {
    const { function: fn, arguments: args, call_id } = req.body;
    const input = typeof args === 'string' ? JSON.parse(args) : args;
    console.log(`[Vapi] Tool call: ${fn} callId=${call_id}`, input);

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
    console.log(`[Vapi] Processing: status=${status} callId=${call_id}`);

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

        console.log(`[Vapi] Call ended: callId=${call_id} booked=${wasBooked}`);

        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                status: wasBooked ? 'RECOVERED' : 'RECOVERING',
                smsStatus: wasBooked ? 'sent' : mc.smsStatus,
                ...(summary && { aiConversation: JSON.stringify([{ role: 'system', content: summary }]) }),
            }
        });

        if (!wasBooked) {
            await triggerSmsFallback(mc);
        }
    }
}

async function handleVoiceBooking(mc, input) {
    const { patient_name, preferred_day, preferred_time } = input;
    console.log(`[Vapi] Booking via voice: ${patient_name} — ${preferred_day} ${preferred_time}`);

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

    let startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0, 0);
    try {
        const lowerDay = (preferred_day || '').toLowerCase();
        if (lowerDay.includes('σήμερα') || lowerDay.includes('today')) {
            startTime = new Date();
        } else if (lowerDay.includes('αύριο') || lowerDay.includes('tomorrow')) {
            startTime = new Date();
            startTime.setDate(startTime.getDate() + 1);
        }
        const timeStr = (preferred_time || '').toLowerCase();
        const digitMatch = timeStr.match(/(\d{1,2})(?::(\d{2}))?/);
        if (digitMatch) {
            const hour = parseInt(digitMatch[1]);
            const min = parseInt(digitMatch[2] || '0');
            startTime.setHours(hour, min, 0, 0);
        }
    } catch {}

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    if (patient) {
        try {
            await prisma.appointment.create({
                data: {
                    clinicId: clinic.id,
                    patientId: patient.id,
                    startTime,
                    endTime,
                    reason: 'Ραντεβού από AI φωνητική ανάκτηση',
                    notes: `Ημέρα: ${preferred_day} | Ώρα: ${preferred_time}`,
                    status: 'PENDING',
                    priority: 'NORMAL',
                }
            });
            console.log(`[Vapi] Appointment created`);
        } catch (err) {
            console.warn('[Vapi] Appointment create failed:', err.message);
        }
    }

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

    console.log(`[Vapi] Case RECOVERED: ${mc.id}`);
}

async function handleVoiceCallback(mc) {
    console.log(`[Vapi] Callback requested`);
    await prisma.missedCall.update({
        where: { id: mc.id },
        data: { conversationState: 'CALLBACK', status: 'RECOVERING' }
    });
}

async function triggerSmsFallback(mc) {
    const clinic = mc.clinic;
    if (!clinic) return;

    const bookingLink = `${process.env.FRONTEND_URL || 'https://clinicflow.app'}/book?clinicId=${clinic.id}`;
    const clinicName = clinic.name || 'το ιατρείο';
    const smsBody = `Σας καλέσαμε από το ${clinicName} αλλά δεν απαντήσατε.\nΚλείστε ραντεβού εδώ: ${bookingLink}`;

    console.log(`[Vapi] SMS fallback → ${mc.fromNumber}`);
    await triggerN8nSms(clinic, mc.fromNumber, smsBody, mc.id);
}

module.exports = router;