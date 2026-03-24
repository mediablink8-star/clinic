const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { triggerWebhook } = require('../services/webhookService');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/simulate-vapi', asyncHandler(async (req, res) => {
    // req.clinic and req.clinicId are now attached by mandatory requireClinic middleware in index.js
    const clinic = req.clinic;

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

        // 2. Trigger Webhook (Await response for testing)
        const webhookResult = await triggerWebhook('appointment.created', {
            appointmentId: appointment.id,
            clinicId: clinic.id,
            clinicName: clinic.name,
            patientName: "Test Guest",
            date: dateStr,
            time: timeStr,
            reason: "Test Appointment (Simulation)",
            priority: 'NORMAL'
        }, clinic.webhookUrl, null, { awaitResponse: true });

        res.json({
            success: true,
            message: "Simulated Booking Successful!",
            details: {
                db_appointment: appointment.id,
                webhook_triggered: webhookResult.success,
                target_url: clinic.webhookUrl || "None",
                responseTime: webhookResult.duration,
                webhook_details: webhookResult
            }
        });

    } catch (error) {
        console.error('[TEST] Simulation Failed:', error);
        res.status(500).json({ error: error.message });
    }
}));

/**
 * @route POST /api/test/ping-make
 * @desc Sends a simple "ping" event to the webhook URL
 */
router.post('/ping-make', asyncHandler(async (req, res) => {
    const clinic = req.clinic;

    if (!clinic || !clinic.webhookUrl) {
        return res.status(400).json({ error: 'No webhook URL configured for this clinic.' });
    }

    const { success, duration, message, error } = await triggerWebhook('system.ping', {
        message: "This is a test from ClinicFlow Settings.",
        user: "Admin",
        time: new Date().toISOString()
    }, clinic.webhookUrl, null, { awaitResponse: true });

    if (success) {
        res.json({ success: true, message: `Ping sent to ${clinic.webhookUrl}`, responseTime: duration });
    } else {
        res.status(500).json({ error: error || message || 'Failed to send ping.', responseTime: duration });
    }
}));

module.exports = router;
