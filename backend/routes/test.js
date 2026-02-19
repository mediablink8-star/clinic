const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { triggerWebhook } = require('../services/webhookService');

// Middleware to require clinic context is NOT applied globally here
// because we might want to test generically, but we'll try to use it if passed.

/**
 * @route POST /api/test/simulate-vapi
 * @desc Simulates a Vapi webhook call (booking request)
 */
router.post('/simulate-vapi', async (req, res) => {
    const clinicId = req.headers['x-clinic-id'];
    if (!clinicId) return res.status(400).json({ error: 'Missing x-clinic-id header' });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    // Mock Vapi Payload
    const mockPayload = {
        message: {
            type: "tool-calls",
            toolCalls: [
                {
                    id: "test_" + Date.now(),
                    function: {
                        name: "book_appointment",
                        arguments: JSON.stringify({
                            reason: "Test Appointment (Simulation)",
                            date: new Date().toISOString().split('T')[0], // Today
                            time: "14:00"
                        })
                    }
                }
            ]
        }
    };

    console.log(`[TEST] Simulating Vapi Call for ${clinic.name}...`);

    // We can forward this to the actual Vapi route handler logic
    // OR just duplicate the logic here for safety/simplicity in testing
    // Let's call the internal logic by fetch or just execute the creation directly.
    // Executing directly is cleaner for a "Test Button".

    try {
        // 1. Create Appointment for TOMORROW at 10:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);

        const startTime = tomorrow;
        const endTime = new Date(startTime);
        endTime.setMinutes(30);

        const dateStr = startTime.toISOString().split('T')[0];
        const timeStr = "10:00";

        let patient = await prisma.patient.findFirst({
            where: { clinicId: clinic.id, phone: 'TestGuest' }
        });

        if (!patient) {
            patient = await prisma.patient.create({
                data: {
                    clinicId: clinic.id,
                    name: "Test Guest",
                    phone: "TestGuest",
                    email: "test@guest.com"
                }
            });
        }

        const appointment = await prisma.appointment.create({
            data: {
                clinicId: clinic.id,
                patientId: patient.id,
                startTime: startTime,
                endTime: endTime,
                reason: "Test Appointment (Simulation)",
                priority: 'NORMAL',
                aiClassification: 'Simulation',
                status: 'CONFIRMED'
            }
        });

        // 2. Trigger Webhook
        const webhookSent = await triggerWebhook('appointment.created', {
            appointmentId: appointment.id,
            clinicId: clinic.id,
            clinicName: clinic.name,
            patientName: "Test Guest",
            date: dateStr,
            time: timeStr,
            reason: "Test Appointment (Simulation)",
            priority: 'NORMAL'
        }, clinic.webhookUrl);

        res.json({
            success: true,
            message: "Simulated Booking Successful!",
            details: {
                db_appointment: appointment.id,
                webhook_triggered: webhookSent,
                target_url: clinic.webhookUrl || "None"
            }
        });

    } catch (error) {
        console.error('[TEST] Simulation Failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @route POST /api/test/ping-make
 * @desc Sends a simple "ping" event to the webhook URL
 */
router.post('/ping-make', async (req, res) => {
    const clinicId = req.headers['x-clinic-id'];
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

    if (!clinic || !clinic.webhookUrl) {
        return res.status(400).json({ error: 'No webhook URL configured for this clinic.' });
    }

    const sent = await triggerWebhook('system.ping', {
        message: "This is a test from ClinicFlow Settings.",
        user: "Admin",
        time: new Date().toISOString()
    }, clinic.webhookUrl);

    if (sent) {
        res.json({ success: true, message: `Ping sent to ${clinic.webhookUrl}` });
    } else {
        res.status(500).json({ error: 'Failed to send ping.' });
    }
});

module.exports = router;
