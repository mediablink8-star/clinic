const { triggerWebhook } = require('./backend/services/webhookService');

// Mock fetch to avoid network calls and just see where they would go
global.fetch = async (url, options) => {
    console.log(`[TEST MOCK] Fetching: ${url}`);
    return { ok: true, status: 200 };
};

async function runTests() {
    console.log('--- STARTING WEBHOOK ROUTING TESTS ---');

    const globalUrl = 'https://global.webhook.com';
    const overrideUrl = 'https://override.webhook.com';

    const mockClinic = {
        id: 'test-clinic-1',
        name: 'Test Clinic',
        webhookUrl: globalUrl,
        webhookSecret: 'test-secret',
        webhookMissedCall: null,
        webhookAppointment: null,
        webhookReminders: null,
        webhookDirectSms: null,
        webhookInboundSms: null
    };

    // Test 1: Global URL fallback
    console.log('\nTest 1: Expecting global URL for missed_call.detected...');
    await triggerWebhook('missed_call.detected', { data: 1 }, null, null, { clinic: mockClinic });

    // Test 2: Missed Call override
    console.log('\nTest 2: Expecting override URL for missed_call.detected...');
    mockClinic.webhookMissedCall = overrideUrl;
    await triggerWebhook('missed_call.detected', { data: 2 }, null, null, { clinic: mockClinic });

    // Test 3: Appointment override
    console.log('\nTest 3: Expecting override URL for appointment.created...');
    mockClinic.webhookAppointment = overrideUrl;
    await triggerWebhook('appointment.created', { data: 3 }, null, null, { clinic: mockClinic });

    // Test 4: Inbound SMS override
    console.log('\nTest 4: Expecting override URL for message.inbound...');
    mockClinic.webhookInboundSms = overrideUrl;
    await triggerWebhook('message.inbound', { data: 4 }, null, null, { clinic: mockClinic });

    // Test 5: Global URL for something else (e.g., system.ping)
    console.log('\nTest 5: Expecting global URL for system.ping (no override)...');
    await triggerWebhook('system.ping', { data: 5 }, null, null, { clinic: mockClinic });

    console.log('\n--- TESTS COMPLETED ---');
}

runTests().catch(err => {
    console.error('Tests failed:', err);
    process.exit(1);
});
