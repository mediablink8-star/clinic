const fetch = require('node-fetch'); // Assuming node-fetch is available or using native fetch

async function verifyUpgrade() {
    console.log('🧪 Starting SaaS Upgrade Verification...');
    const baseUrl = 'http://127.0.0.1:4000/api';

    try {
        // 1. Test Login
        console.log('1. Testing Login...');
        const loginRes = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@clinicflow.com', password: 'admin123' })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.statusText}`);
        const loginData = await loginRes.json();
        console.log('✅ Login successful:', loginData.clinic.name);
        const accessToken = loginData.token;

        // 2. Test Protected Route
        console.log('2. Testing Protected Route (/api/patients)...');
        const patientsRes = await fetch(`${baseUrl}/patients`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!patientsRes.ok) throw new Error(`Protected route failed: ${patientsRes.statusText}`);
        console.log('✅ Access to protected route successful');

        // 3. Test Refresh Token (Simulation)
        // Since we are using cookies, we'd need a cookie jar or just check the response headers
        console.log('3. Note: Refresh token verification requires cookie handling (skipping manual fetch check)');

        // 4. Test BullMQ Enqueuer (Check logs if possible)
        console.log('4. Verification complete. Manual check of logs recommended for BullMQ enqueuing.');

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
    }
}

verifyUpgrade();
