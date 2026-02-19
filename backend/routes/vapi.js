const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * @route POST /api/vapi/webhook
 * @desc Unified webhook for Vapi events (assistant-request, tool-call)
 * @note Webhook URL must include ?clinicId=...
 */
router.post('/webhook', async (req, res) => {
    const { message } = req.body;
    const clinicId = req.query.clinicId;

    if (!message) return res.status(400).json({ error: 'No message provided' });
    if (!clinicId) return res.status(400).json({ error: 'Missing clinicId query parameter' });

    // Fetch Dynamic Clinic Context
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    console.log(`[VAPI] Received message type: ${message.type} for Clinic: ${clinic.name}`);

    // 1. DYNAMIC ASSISTANT CONFIGURATION
    if (message.type === 'assistant-request') {
        const services = JSON.parse(clinic.services);
        const policies = JSON.parse(clinic.policies);
        const hours = JSON.parse(clinic.workingHours);

        const assistant = {
            name: `${clinic.name} Receptionist`,
            firstMessage: `Γεια σας, είμαι η ψηφιακή γραμματεία του "${clinic.name}". Πώς μπορώ να σας βοηθήσω;`,
            model: {
                provider: "openai",
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are the AI Receptionist for "${clinic.name}". Your ONLY goal is to book an appointment.
                        
                        Context:
                        - Clinic: ${clinic.name}
                        - Location: ${clinic.location}
                        - Phone: ${clinic.phone}
                        - Services: ${services.map(s => s.name).join(', ')} (Prices available if asked)
                        - Hours: ${JSON.stringify(hours)}

                        Strict Rules:
                        1. Language: Speak ONLY Greek (Ελληνικά).
                        2. Goal: Get the Date, Time, and Reason to call the 'book_appointment' tool.
                        3. Style: Professional, warm, but concise. Do not waste time.
                        4. Boundaries: 
                           - Do NOT give medical advice.
                           - If asked about something else, politely steer back to booking: "I can only help with appointments. Would you like to schedule one?"
                        5. Flow:
                           - Ask for the reason of visit.
                           - Propose a time (or ask for preference).
                           - Confirm and book.
                        `
                    }
                ],
                tools: [
                    {
                        type: "function",
                        function: {
                            name: "book_appointment",
                            description: "Books an appointment for the patient.",
                            parameters: {
                                type: "object",
                                properties: {
                                    reason: { type: "string", description: "Reason for visit" },
                                    date: { type: "string", description: "Date of appointment (YYYY-MM-DD)" },
                                    time: { type: "string", description: "Time of appointment (HH:MM)" }
                                },
                                required: ["reason", "date", "time"]
                            }
                        }
                    }
                ]
            },
            voice: {
                provider: "elevenlabs",
                voiceId: "glanni",
            },
            transcriber: {
                provider: "deepgram",
                model: "nova-2",
                language: "el"
            }
        };
        return res.json({ assistant });
    }

    // 2. TOOL CALLS (Booking Logic)
    if (message.type === 'tool-calls') {
        const toolCall = message.toolCalls[0];
        if (toolCall.function.name === 'book_appointment') {
            const { reason, date, time } = JSON.parse(toolCall.function.arguments);
            console.log(`[VAPI] Booking requested: ${reason} on ${date} ${time} for ${clinic.name}`);

            try {
                // 1. Create Appointment in DB
                const startTime = new Date(`${date}T${time}:00`);
                const endTime = new Date(startTime.getTime() + 30 * 60000); // Default 30 min duration

                // Find or create a "Guest" patient for voice calls if not provided
                let patient = await prisma.patient.findFirst({
                    where: { clinicId: clinic.id, phone: 'VoiceGuest' }
                });

                if (!patient) {
                    patient = await prisma.patient.create({
                        data: {
                            clinicId: clinic.id,
                            name: "Guest (Voice)",
                            phone: "VoiceGuest",
                            email: "guest@voice.com"
                        }
                    });
                }

                const appointment = await prisma.appointment.create({
                    data: {
                        clinicId: clinic.id,
                        patientId: patient.id,
                        startTime: startTime,
                        endTime: endTime,
                        reason: reason,
                        priority: 'NORMAL',
                        aiClassification: 'Voice Booking',
                        status: 'CONFIRMED'
                    }
                });

                // 2. Trigger Webhook (Sync to Make.com -> Google Calendar)
                const { triggerWebhook } = require('../services/webhookService');

                triggerWebhook('appointment.created', {
                    appointmentId: appointment.id,
                    clinicId: clinic.id,
                    clinicName: clinic.name,
                    patientName: "Voice Guest",
                    date: date,
                    time: time,
                    reason: reason,
                    priority: 'NORMAL'
                }, clinic.webhookUrl);

                return res.json({
                    results: [{
                        toolCallId: toolCall.id,
                        result: `Το ραντεβού για "${reason}" στις ${date} και ώρα ${time} καταχωρήθηκε επιτυχώς!`
                    }]
                });

            } catch (error) {
                console.error('[VAPI] Booking Error:', error);
                return res.json({
                    results: [{
                        toolCallId: toolCall.id,
                        result: `Υπήρξε ένα πρόβλημα με την κράτηση. Παρακαλώ καλέστε την γραμματεία.`
                    }]
                });
            }
        }
    }

    res.status(200).json({ ok: true });
});

module.exports = router;
