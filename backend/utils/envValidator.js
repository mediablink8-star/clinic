/**
 * Validates required environment variables and logs status.
 * Returns true if all critical variables are present.
 */
function validateEnv() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'DB_ENCRYPTION_KEY'
    ];

    const recommended = [
        'WEBHOOK_SECRET',
        'AUTOMATION_API_KEY',
        'GEMINI_API_KEY',
        'N8N_WEBHOOK_URL',
        'BACKEND_API_URL',
        'FRONTEND_URL',
        'BLAND_API_KEY',
    ];

    let allRequiredPresent = true;
    const missingRequired = [];
    const missingRecommended = [];

    required.forEach(key => {
        if (!process.env[key]) {
            allRequiredPresent = false;
            missingRequired.push(key);
        }
    });

    recommended.forEach(key => {
        if (!process.env[key]) {
            missingRecommended.push(key);
        }
    });

    if (missingRequired.length > 0) {
        console.error('\n❌ CRITICAL ERROR: Missing required environment variables:');
        missingRequired.forEach(key => console.error(`   - ${key}`));
    }

    if (missingRecommended.length > 0) {
        console.warn('\n⚠️  WARNING: Some recommended environment variables are missing:');
        missingRecommended.forEach(key => console.warn(`   - ${key}`));
        console.warn('   (Some features like Webhooks or AI might be disabled or limited)\n');
    }

    return allRequiredPresent;
}

module.exports = { validateEnv };
