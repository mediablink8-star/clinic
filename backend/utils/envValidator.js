/**
 * Validates required environment variables and logs status.
 * Returns true if all critical variables are present.
 */
function validateEnv() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REFRESH_TOKEN_SECRET',
        'DB_ENCRYPTION_KEY',
        'FRONTEND_URL'
    ];

    const recommended = [
        'WEBHOOK_SECRET',
        'AUTOMATION_API_KEY',
        'GEMINI_API_KEY',
        'N8N_WEBHOOK_URL',
        'BACKEND_API_URL',
        'SMTP_HOST',
        'REDIS_URL',
        'SENTRY_BACKEND_DSN',
        'TWILIO_ACCOUNT_SID',
        'TWILIO_AUTH_TOKEN',
        'TWILIO_PHONE_NUMBER',
        'VAPI_API_KEY',
        'DATABASE_CONNECTION_POOL_URL',
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

    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            console.error('⚠️  SMTP_HOST not set in production — password reset emails will FAIL silently.');
            console.error('   Users who forget their password will be locked out unless webhooks are configured.');
            console.error('   Set SMTP_HOST, SMTP_USER, SMTP_PASS (e.g. Resend: host=smtp.resend.com, port=465).');
        } else {
            console.warn('⚠️  SMTP_HOST not set — using Ethereal test account in development.');
        }
    }
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        console.warn('⚠️  REDIS_URL not set — background SMS/reminder jobs will be skipped in production. Provision Redis (e.g. Upstash) and set REDIS_URL.');
    }
    if (!process.env.DATABASE_CONNECTION_POOL_URL && process.env.NODE_ENV === 'production') {
        console.warn('⚠️  DATABASE_CONNECTION_POOL_URL not set — Prisma will use direct connections. For production, use PgBouncer or Supavisor to pool connections.');
    }

    return allRequiredPresent;
}

module.exports = { validateEnv };
