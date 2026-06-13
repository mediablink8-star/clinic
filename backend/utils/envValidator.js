/**
 * Validates environment variables and prints a clear, categorized
 * status report at boot. The goal: an operator reading the boot log
 * should know exactly which vars to set, why, and what happens if
 * they don't — without having to read this file.
 *
 * Categories:
 *   REQUIRED          — boot will refuse if missing
 *   SET ONCE          — global, set in Render env once and forget
 *   FEATURE GATED     — only needed when you wire that feature
 *   PER-CLINIC (DB)   — NOT env vars; stored in Clinic table, set per onboarding
 *   OPT-IN HARDENING  — defense-in-depth, intentionally off by default
 */

const HINT = {
    // ── SET ONCE ──
    BACKEND_API_URL:
        'Set once to your Render URL: https://api.clinicflow.app\n         (used in absolute URLs sent to external services like Twilio, Vapi, n8n)',
    N8N_WEBHOOK_URL:
        'Set once to your n8n VPS base: https://n8n-znz6.srv1664589.hstgr.cloud\n         (per-clinic paths get appended automatically)',
    VAPI_API_KEY:
        'Set once from https://dashboard.vapi.ai → Settings → API Keys',
    VAPI_ASSISTANT_ID:
        'Set once from your Vapi assistant (used only if a clinic has not set its own)',
    VAPI_PHONE_NUMBER_ID:
        'Set once from your Vapi phone number (used only if a clinic has not set its own)',
    ZADARMA_API_KEY:
        'Set once from your Zadarma account (used only if a clinic has not set its own)',
    ZADARMA_API_SECRET:
        'Set once from your Zadarma account (used only if a clinic has not set its own)',
    ZADARMA_WEBHOOK_SECRET:
        'Recommended: set to a random 48-char hex string. Auto-generated if absent, but you\'ll need to re-paste it into the Zadarma panel after every restart.',
    TWILIO_ACCOUNT_SID:
        'Set once from https://console.twilio.com (master account, used until per-clinic subaccounts are wired)',
    TWILIO_AUTH_TOKEN:
        'Set once from https://console.twilio.com. Required in production — /api/webhook/sms-status refuses without it.',
    TWILIO_PHONE_NUMBER:
        'Set once to your Greek or alphanumeric sender (e.g. +30... or ClinicFlow). Used as default when a clinic has not set its own.',
    TWILIO_ALPHA_SENDER_ID:
        'Optional alphanumeric sender ID (e.g. "ClinicFlow") shown on recipient phones in Greece/EU',
    TWILIO_MESSAGING_SERVICE_SID:
        'Optional — Twilio Messaging Service for advanced routing (not needed for MVP)',
    GEMINI_API_KEY:
        'Set once from https://aistudio.google.com/app/apikey (used only if a clinic has not set its own)',
    WEBHOOK_SECRET:
        'Set once. Generate with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n         Used for /api/automation/* HMAC signing. n8n must use the same value.',
    AUTOMATION_API_KEY:
        'Set once. Generate same way as WEBHOOK_SECRET. Alternative header-based auth for /api/automation/*',
    MBAS_SYSTEM_SECRET:
        'Set once. Generate same way as WEBHOOK_SECRET. Used for /api/automation/* system-level endpoints.\\n         MUST be different from VAPI_WEBHOOK_SECRET to prevent cross-domain compromise.',
    REGISTRATION_INVITE_CODE:
        'Set once. A shared secret that lets prospective clinics create an account via /api/auth/register.\n         Without it, registration is closed and the owner provisions clinics manually via Admin Dashboard.',
    TRIAL_DAYS:
        'Default 14. Number of days a new clinic gets for free after POST /api/clinic/onboarding-complete.',
    BILLING_GRACE_DAYS:
        'Default 7. Days after a failed payment before the account is locked.',
    GOOGLE_CLIENT_ID:
        'Optional — only if a clinic wants Google Calendar sync. Set per-clinic in DB once they complete OAuth.',
    GOOGLE_CLIENT_SECRET:
        'Optional — only if a clinic wants Google Calendar sync.',
    GOOGLE_CALENDAR_REDIRECT_URI:
        'Optional — only if a clinic wants Google Calendar sync.',

    // ── FEATURE GATED ──
    STRIPE_SECRET_KEY:
        'Set when you wire Stripe (before first paying client). Get from https://dashboard.stripe.com/apikeys',
    STRIPE_WEBHOOK_SECRET:
        'Set when you wire Stripe. Get from Stripe Dashboard → Webhooks → Add endpoint → Signing secret (whsec_...)',
    STRIPE_PUBLISHABLE_KEY:
        'Set when you wire Stripe. Goes to Vercel as VITE_STRIPE_PUBLISHABLE_KEY too (frontend needs it for Checkout).',
    STRIPE_PRICE_STARTER_MONTHLY:
        'Set when you wire Stripe. Create the price in Stripe Dashboard → Products → Starter plan → Monthly recurring.',
    STRIPE_PRICE_GROWTH_MONTHLY:
        'Set when you wire Stripe. Create the price in Stripe Dashboard → Products → Growth plan → Monthly recurring.',
    STRIPE_PRICE_SCALE_MONTHLY:
        'Set when you wire Stripe. Create the price in Stripe Dashboard → Products → Scale plan → Monthly recurring.',
    STRIPE_GREEK_VAT_TAX_RATE_ID:
        'Optional. Cache for the 24% Greek VAT Stripe Tax Rate (txr_...). Auto-created on first checkout if missing. Set this to skip the lookup.',
    SENTRY_BACKEND_DSN:
        'Set when you wire Sentry (Phase 4.2). Get from https://sentry.io → Project → Settings → Client Keys (DSN).',
    DATABASE_CONNECTION_POOL_URL:
        'Set when traffic justifies it (post-MVP, >50 active clinics). Use Supavisor or PgBouncer in front of Supabase.',

    // ── OPT-IN HARDENING ──
    KNOWN_CLINIC_IDS:
        'OPT-IN defense-in-depth. Empty = no allowlist = no clinic is restricted.\n         ONLY set if you have third-party services calling /api/automation/* directly on behalf of specific clinics.\n         Operators do NOT update this per onboarding — leave unset.',

    // ── REQUIRED ──
    DATABASE_URL:
        'Set to your Supabase pooled connection string. Get from Supabase → Project → Settings → Database → Connection string (Transaction mode, port 6543).',
    JWT_SECRET:
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"',
    REFRESH_TOKEN_SECRET:
        'Generate same way. Must be DIFFERENT from JWT_SECRET.',
    DB_ENCRYPTION_KEY:
        'Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))". Used to encrypt clinic.geminiApiKey and similar secrets at rest.',
    FRONTEND_URL:
        'Set to your Vercel production URL: https://clinicflow.app (must match Vercel deployment URL exactly or CORS breaks).',
    SMTP_HOST:
        'Set to your SMTP host. Resend example: smtp.resend.com:465. Required in production — password resets and demo-request emails will fail silently without it.',
    SMTP_PORT:
        'Optional. 587 (TLS) or 465 (SSL). Defaults to 587.',
    SMTP_USER:
        'SMTP username (often an API key for transactional providers).',
    SMTP_PASS:
        'SMTP password (often the API key).',
    SMTP_FROM:
        'Default sender address shown in recipient inbox.',
    REDIS_URL:
        'Set to your Upstash Redis URL. Required in production for cluster-safe background jobs.',
    DISABLE_REDIS:
        'Set to "true" only for local dev if you don\'t want to run Redis.',
    DISABLE_WORKER:
        'Set to "true" only for local dev to skip the background worker.',
    USE_INTERNAL_AUTOMATION:
        'Set to "true" to use the in-process n8n replacement (EXPERIMENTAL — leave false for production).',
    ALLOW_PRIVATE_WEBHOOK_URLS:
        'Set to "true" ONLY in dev to allow webhooks to 127.0.0.1 / 10.x / 192.168.x. Refused in production.',
    SALES_NOTIFY_EMAIL:
        'Optional. If set, /api/leads/demo submissions are forwarded here. Defaults to SMTP_USER if unset.',
};

const SET_ONCE = [
    'BACKEND_API_URL',
    'N8N_WEBHOOK_URL',
    'VAPI_API_KEY',
    'VAPI_ASSISTANT_ID',
    'VAPI_PHONE_NUMBER_ID',
    'ZADARMA_API_KEY',
    'ZADARMA_API_SECRET',
    'ZADARMA_WEBHOOK_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'TWILIO_ALPHA_SENDER_ID',
    'TWILIO_MESSAGING_SERVICE_SID',
    'GEMINI_API_KEY',
    'WEBHOOK_SECRET',
    'AUTOMATION_API_KEY',
    'REGISTRATION_INVITE_CODE',
    'TRIAL_DAYS',
    'BILLING_GRACE_DAYS',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CALENDAR_REDIRECT_URI',
];

const FEATURE_GATED = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_PRICE_STARTER_MONTHLY',
    'STRIPE_PRICE_GROWTH_MONTHLY',
    'STRIPE_PRICE_SCALE_MONTHLY',
    'STRIPE_GREEK_VAT_TAX_RATE_ID',
    'SENTRY_BACKEND_DSN',
    'SENTRY_FRONTEND_DSN',
    'SENTRY_TRACES_SAMPLE_RATE',
    'DATABASE_CONNECTION_POOL_URL',
];

const OPT_IN_HARDENING = [
    'KNOWN_CLINIC_IDS',
];

const PER_CLINIC_DB_NOTE = `
   ℹ️  PER-CLINIC settings are stored in the Clinic table, NOT in env vars.
      Operators configure these per onboarding via the Admin Dashboard:
        - Twilio sender (or per-clinic Twilio subaccount in future)
        - Vapi assistant + phone (clinic.vapiAssistantId, clinic.vapiPhoneNumberId)
        - Zadarma phone + API (clinic.zadarmaPhoneNumber, clinic.zadarmaApiKey)
        - Gemini key override (clinic.geminiApiKey, encrypted at rest)
        - 7 webhook URLs (clinic.webhookUrl, etc.)
        - Working hours, services, doctor profiles
      You will NEVER need to restart Render to add a new clinic.
`;

function printCategory(label, vars) {
    const present = [];
    const missing = [];
    vars.forEach((key) => {
        if (process.env[key]) present.push(key);
        else missing.push(key);
    });

    if (missing.length === 0) {
        console.log(`   ✅  ${label}: all ${present.length} configured`);
        return [];
    }

    console.log(`\n   ⚠️  ${label} — ${missing.length} missing:`);
    missing.forEach((key) => {
        const hint = HINT[key] ? `\n         → ${HINT[key]}` : '';
        console.log(`      - ${key}${hint}`);
    });
    return missing;
}

function validateEnv() {
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REFRESH_TOKEN_SECRET',
        'DB_ENCRYPTION_KEY',
        'FRONTEND_URL',
    ];

    if (process.env.NODE_ENV === 'production') {
        required.push('SMTP_HOST', 'REDIS_URL', 'MBAS_SYSTEM_SECRET');
    }

    // SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM are needed when SMTP_HOST is set,
    // but the audit will catch them via the SMTP-specific block below.
    const missingRequired = required.filter((k) => !process.env[k]);

    if (missingRequired.length > 0) {
        console.error('\n❌ CRITICAL: Required environment variables missing (app will not start):');
        missingRequired.forEach((key) => {
            const hint = HINT[key] ? `\n   → ${HINT[key]}` : '';
            console.error(`   - ${key}${hint}`);
        });
        return false;
    }

    console.log('\n📋  ENVIRONMENT AUDIT');
    console.log('   ─────────────────────────────────────────────────────────');

    const allMissing = [];

    // SMTP
    if (!process.env.SMTP_HOST) {
        if (process.env.NODE_ENV === 'production') {
            console.error('   ❌  SMTP_HOST not set in production — password resets and demo-request emails will FAIL silently.');
            console.error('   → Set SMTP_HOST, SMTP_USER, SMTP_PASS (e.g. Resend: host=smtp.resend.com, port=465, user=resend, pass=<API_KEY>).');
            allMissing.push('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS');
        } else {
            console.log('   ℹ️  SMTP_HOST not set — using Ethereal test account in development.');
        }
    } else {
        ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach((k) => {
            if (!process.env[k]) console.log(`   ⚠️  ${k} not set — using sensible default`);
        });
    }

    allMissing.push(...printCategory('SET ONCE (Render env, one-time)', SET_ONCE));
    allMissing.push(...printCategory('FEATURE GATED (set when you wire that feature)', FEATURE_GATED));
    allMissing.push(...printCategory('OPT-IN HARDENING (defense-in-depth, off by default)', OPT_IN_HARDENING));

    // Per-clinic reminder
    if (process.env.NODE_ENV === 'production') {
        console.log(PER_CLINIC_DB_NOTE);
    }

    // Legacy one-off warnings (only fires for the actually-set cases)
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
        console.log('   ⚠️  REDIS_URL not set — background jobs will use single-process DB polling fallback. Provision Upstash Redis for cluster-safe scheduling.');
    }
    if (!process.env.DATABASE_CONNECTION_POOL_URL && process.env.NODE_ENV === 'production') {
        console.log('   ⚠️  DATABASE_CONNECTION_POOL_URL not set — Prisma uses direct connections. Add Supavisor/PgBouncer when traffic grows.');
    }
    if (!process.env.STRIPE_SECRET_KEY) {
        if (process.env.NODE_ENV === 'production') {
            console.log('   ⚠️  STRIPE_SECRET_KEY not set — paid plan upgrades are disabled. Set it before onboarding first paying client.');
        }
    }

    if (allMissing.length > 0) {
        console.log(`\n   📝  ${allMissing.length} optional var(s) missing. App will run, but affected features will be disabled.`);
        console.log('   ─────────────────────────────────────────────────────────\n');
    } else {
        console.log('\n   ✨  All optional vars configured.');
        console.log('   ─────────────────────────────────────────────────────────\n');
    }

    return true;
}

module.exports = { validateEnv };
