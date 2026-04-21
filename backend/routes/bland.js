/**
 * Bland AI Webhook Handler
 * 
 * Receives events from Bland AI:
 * - call.started — inbound forwarded call or outbound call connected
 * - tool_call — AI wants to book appointment or request callback
 * - call.ended — call finished, determine if SMS fallback needed
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../services/prisma');
const { handleMissedCall, markRecovered } = require('../services/missedCallService');
const { handleInboundReply } = require('../services/conversationService');
const { triggerN8nSms } = require('../services/blandSmsService');

/**
 * POST /api/bland/webhook
 * Main webhook from Bland AI — no auth header (Bland sends to public URL)
 * We validate by checking the call exists in our DB or via Bland's signature
 */
router.post('/webhook', asyncHandler(async (req, res) => {
    const event = req.body;
    const callId = event.call_id;
    const eventType = event.type || event.status;

    console.log(`[Bland] Webhook: type=${eventType} callId=${callId}`);

    // Always respond 200 immediately to Bland
    res.json({ success: true });

    // Process async
    setImmediate(() => handleBlandEvent(event).catch(err =>
        console.error('[Bland] handleBlandEvent error:', err.message)
    ));
}));

/**
 * POST /api/bland/tool
 * Called by Bland AI when the agent invokes a tool (book_appointment, request_callback)
 */
router.post('/tool', asyncHandler(async (req, res) => {
    const { name, input, call_id } = req.body;
    console.log(`[Bland] Tool call: ${name} callId=${call_id}`, input);

    // Find the missed call by callSid
    const mc = await prisma.missedCall.findFirst({
        where: { callSid: call_id },
        include: { clinic: true }
    });

    if (!mc) {
        console.warn(`[Bland] Tool call — no missed call for callId=${call_id}`);
        return res.json({ success: false, message: 'Case not found' });
    }

    if (name === 'book_appointment') {
        await handleVoiceBooking(mc, input);
        return res.json({ success: true, message: `Το ραντεβού καταχωρήθηκε για ${input.preferred_day} στις ${input.preferred_time}. Θα λάβετε επιβεβαίωση σύντομα.` });
    }

    if (name === 'request_callback') {
        await handleVoiceCallback(mc);
        return res.json({ success: true, message: 'Το αίτημα επανάκλησης καταχωρήθηκε.' });
    }

    res.json({ success: false, message: 'Unknown tool' });
}));
 * Bland fires this before answering — we log the missed call.
 */
router.post('/inbound', asyncHandler(async (req, res) => {
    const { from, to, call_id } = req.body;

    console.log(`[Bland] Inbound call: from=${from} to=${to} callId=${call_id}`);

    // Resolve clinic from the Bland phone number
    const clinic = await prisma.clinic.findFirst({
        where: { blandPhoneNumberId: to }
    });

    if (!clinic) {
        console.warn(`[Bland] No clinic found for phone number ${to}`);
        return res.json({ success: false, reason: 'clinic_not_found' });
    }

    // Log as missed call (the original clinic call was missed, this is the recovery)
    const { data } = await handleMissedCall({
        phone: from,
        clinicId: clinic.id,
        callSid: call_id,
        bypassCooldown: false,
        source: 'BLAND_INBOUND',
    });

    console.log(`[Bland] Missed call logged: ${data.missedCallId}`);
    res.json({ success: true, missedCallId: data.missedCallId });
}));

async function handleBlandEvent(event) {
    const { call_id, type, status, metadata, tool_calls, call_length, answered_by } = event;

    // Extract our metadata
    const missedCallId = metadata?.missedCallId;
    const clinicId = metadata?.clinicId;

    if (!clinicId) {
        // Try to find by callSid
        const mc = await prisma.missedCall.findFirst({ where: { callSid: call_id } });
        if (mc) {
            metadata.missedCallId = mc.id;
            metadata.clinicId = mc.clinicId;
        }
    }

    const mc = missedCallId
        ? await prisma.missedCall.findUnique({ where: { id: missedCallId }, include: { clinic: true } })
        : await prisma.missedCall.findFirst({ where: { callSid: call_id }, include: { clinic: true } });

    if (!mc) {
        console.warn(`[Bland] No missed call found for callId=${call_id}`);
        return;
    }

    // ── Tool calls — AI wants to book or request callback ────────────────────
    if (tool_calls && tool_calls.length > 0) {
        for (const tool of tool_calls) {
            if (tool.name === 'book_appointment') {
                await handleVoiceBooking(mc, tool.input);
            } else if (tool.name === 'request_callback') {
                await handleVoiceCallback(mc);
            }
        }
    }

    // ── Call ended ────────────────────────────────────────────────────────────
    if (type === 'call.ended' || status === 'completed' || status === 'ended') {
        const wasAnswered = answered_by === 'human' || (call_length && call_length > 5);
        const wasBooked = mc.status === 'RECOVERED';

        console.log(`[Bland] Call ended: callId=${call_id} answered=${wasAnswered} booked=${wasBooked} duration=${call_length}s`);

        if (!wasAnswered || !wasBooked) {
            // Call not answered or ended without booking — fire SMS fallback
            await triggerSmsFallback(mc);
        }

        // Update call status
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                smsStatus: wasBooked ? 'sent' : mc.smsStatus,
                aiConversation: event.transcript ? JSON.stringify([{ role: 'call', content: event.transcript }]) : mc.aiConversation,
            }
        });
    }
}

async function handleVoiceBooking(mc, input) {
    const { patient_name, preferred_day, preferred_time } = input;
    console.log(`[Bland] Booking via voice: ${patient_name} — ${preferred_day} ${preferred_time}`);

    const clinic = mc.clinic;

    // Upsert patient
    let patient = null;
    try {
        patient = await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinic.id, phone: mc.fromNumber } },
            update: patient_name ? { name: patient_name } : {},
            create: { clinicId: clinic.id, name: patient_name || mc.fromNumber, phone: mc.fromNumber },
        });
    } catch (err) {
        console.warn('[Bland] Patient upsert failed:', err.message);
    }

    // Parse time
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
        const timeMatch = (preferred_time || '').match(/(\d{1,2})(?::(\d{2}))?/);
        if (timeMatch) startTime.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2] || '0'), 0, 0);
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
                    notes: `Ημέρα: ${preferred_day} | Ώρα: ${preferred_time} | Τηλέφωνο: ${mc.fromNumber}`,
                    status: 'PENDING',
                    priority: 'NORMAL',
                }
            });
            console.log(`[Bland] Appointment created for ${mc.fromNumber}`);
        } catch (err) {
            console.warn('[Bland] Appointment create failed:', err.message);
        }
    }

    // Mark as recovered
    await prisma.missedCall.update({
        where: { id: mc.id },
        data: {
            status: 'RECOVERED',
            recoveredAt: new Date(),
            conversationState: 'COMPLETED',
            patientId: patient?.id || null,
        }
    });
}

async function handleVoiceCallback(mc) {
    console.log(`[Bland] Callback requested by ${mc.fromNumber}`);
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

    console.log(`[Bland] SMS fallback → ${mc.fromNumber}`);

    // Trigger via n8n workflow 2 (direct SMS)
    await triggerN8nSms(clinic, mc.fromNumber, smsBody, mc.id);
}

module.exports = router;
