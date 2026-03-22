const API_BASE = 'http://127.0.0.1:4000/api';

async function verifySecurity() {
    console.log('--- STARTING SECURITY VERIFICATION ---');

    // 1. Test Insecure Header Spoofing
    try {
        console.log('1. Testing x-clinic-id spoofing on /api/test/simulate-vapi...');
        const res = await fetch(`${API_BASE}/test/simulate-vapi`, {
            method: 'POST',
            headers: {
                'x-clinic-id': 'anyId',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });
        if (res.ok) {
            console.error('❌ FAIL: Request succeeded without JWT!');
        } else if (res.status === 401) {
            console.log('✅ PASS: Request blocked with 401 (Unauthorized)');
        } else {
            console.error(`❌ Unexpected status: ${res.status}`);
        }
    } catch (err) {
        console.error(`❌ Fetch error: ${err.message}`);
    }

    // 2. Test Admin Route without Admin JWT
    try {
        console.log('2. Testing /api/admin/usage without Admin JWT...');
        const res = await fetch(`${API_BASE}/admin/usage`);
        if (res.ok) {
            console.error('❌ FAIL: Admin route accessible without auth!');
        } else if (res.status === 401 || res.status === 403) {
            console.log(`✅ PASS: Admin route blocked with ${res.status}`);
        } else {
            console.error(`❌ Unexpected status: ${res.status}`);
        }
    } catch (err) {
        console.error(`❌ Fetch error: ${err.message}`);
    }

    // 3. Test Vapi Webhook without Secret
    try {
        console.log('3. Testing /api/vapi/webhook without secret...');
        const res = await fetch(`${API_BASE}/vapi/webhook?clinicId=test_id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { type: 'assistant-request' } })
        });
        if (res.ok) {
            console.error('❌ FAIL: Webhook processed without secret!');
        } else if (res.status === 401) {
            console.log('✅ PASS: Webhook blocked with 401');
        } else {
            console.error(`❌ Unexpected status: ${res.status}`);
        }
    } catch (err) {
        console.error(`❌ Fetch error: ${err.message}`);
    }

    console.log('--- SECURITY VERIFICATION COMPLETE ---');
}

verifySecurity();
