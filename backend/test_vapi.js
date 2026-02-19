const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTest() {
    console.log('🧪 Starting Vapi Booking Simulation Test...');

    // 1. Get Clinic ID (Alpha)
    const clinic = await prisma.clinic.findFirst({
        where: { name: { contains: 'Dental' } }
    });

    if (!clinic) {
        console.error('❌ No clinic found. Please seed the database first.');
        return;
    }
    console.log(`✅ Using Clinic: ${clinic.name} (${clinic.id})`);

    // 2. Simulate Vapi Webhook Payload
    const payload = {
        message: {
            type: "tool-calls",
            toolCalls: [
                {
                    id: "call_12345",
                    function: {
                        name: "book_appointment",
                        arguments: JSON.stringify({
                            reason: "Test Voice Booking",
                            date: "2024-12-25",
                            time: "10:30"
                        })
                    }
                }
            ]
        }
    };

    try {
        // 3. Send Request to Local Backend
        const response = await fetch(`http://localhost:4000/api/vapi/webhook?clinicId=${clinic.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('✅ Vapi Response:', JSON.stringify(data, null, 2));

        if (data.results && data.results[0].result.includes('επιτυχώς')) {
            console.log('🎉 SUCCESS: Appointment booked via Vapi endpoint!');
            console.log('👉 Check your Make.com dashboard history now.');
        } else {
            console.error('❌ FAILED: Unexpected response from Vapi endpoint.');
        }

    } catch (error) {
        console.error('❌ HTTP Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
