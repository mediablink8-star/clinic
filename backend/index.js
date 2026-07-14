require('dotenv').config();

// ── Critical startup safety checks ──────────────────────────────────────────
// ZADARMA_WEBHOOK_SECRET: if unset, webhookAuth.js auto-generates a random value
// that changes on every restart, silently breaking Zadarma webhook delivery.
if (process.env.NODE_ENV === 'production' && !process.env.ZADARMA_WEBHOOK_SECRET) {
    process.stderr.write(
        '\n🔴 CRITICAL: ZADARMA_WEBHOOK_SECRET is not set in production.\n' +
        '   A random secret has been auto-generated for this process only and will\n' +
        '   change on every restart, silently breaking Zadarma webhook delivery.\n' +
        '   Set ZADARMA_WEBHOOK_SECRET in Render environment variables NOW and update\n' +
        '   the Zadarma panel webhook URL to match.\n' +
        '   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n\n'
    );
}

// VAPI_WEBHOOK_SECRET: if unset, all Vapi tool calls (book_appointment) return 401
// and appointments booked via voice are never recorded.
if (process.env.NODE_ENV === 'production' && !process.env.VAPI_WEBHOOK_SECRET) {
    process.stderr.write(
        '\n🟡 WARNING: VAPI_WEBHOOK_SECRET is not set.\n' +
        '   Vapi tool calls (book_appointment) will be allowed through without auth.\n' +
        '   Set VAPI_WEBHOOK_SECRET to the same value as your Vapi assistant Server URL Secret.\n\n'
    );
}

// SMS pipeline check
if (process.env.NODE_ENV === 'production') {
    const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
    const hasSender = !!(process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_ALPHA_SENDER_ID);
    if (!hasTwilio || !hasSender) {
        process.stderr.write(
            '\n🟡 WARNING: Twilio SMS is not fully configured.\n' +
            `   TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? '✓' : '✗ MISSING'}\n` +
            `   TWILIO_AUTH_TOKEN:  ${process.env.TWILIO_AUTH_TOKEN ? '✓' : '✗ MISSING'}\n` +
            `   TWILIO_PHONE_NUMBER / TWILIO_ALPHA_SENDER_ID: ${hasSender ? '✓' : '✗ MISSING'}\n` +
            '   SMS recovery will fail until these are set.\n\n'
        );
    }
}

const { validateEnv } = require('./utils/envValidator');

// Fail fast if critical environment variables are missing
if (!validateEnv()) {
    console.error('FATAL: Required environment variables are missing. Refusing to start.');
    process.exit(1);
}

const logger = require('./utils/logger');
const Sentry = require("@sentry/node");
let server = null;

// gracefulShutdown is defined at line ~600; handlers registered after it

function checkProductionReadiness() {
    if (process.env.NODE_ENV !== 'production') return;

    const criticalVars = [
        { name: 'SENTRY_BACKEND_DSN', critical: true },
        { name: 'SMTP_HOST', critical: true },
        { name: 'DB_ENCRYPTION_KEY', critical: true },
        { name: 'DATABASE_CONNECTION_POOL_URL', critical: false },
        { name: 'REDIS_URL', critical: true },
    ];

    logger.info('Running Production Readiness Audit...');
    let allPurity = true;

    criticalVars.forEach(v => {
        if (!process.env[v.name]) {
            if (v.critical) {
                logger.error(`MISSING CRITICAL: ${v.name}`);
                allPurity = false;
            } else {
                logger.warn(`MISSING OPTIONAL: ${v.name}`);
            }
        } else {
            logger.info(`${v.name} is configured`);
        }
    });

    if (allPurity) {
        logger.info('Production Audit Passed. Systems ready.');
    } else {
        logger.warn('Production Audit Failed. Some systems might be offline.');
    }
}

checkProductionReadiness();

const prisma = require('./services/prisma');
const AppError = require('./errors/AppError');

if (process.env.SENTRY_BACKEND_DSN) {
    const { createBeforeSend } = require('./utils/sentryConfig');
    Sentry.init({
        dsn: process.env.SENTRY_BACKEND_DSN,
        environment: process.env.NODE_ENV || 'development',
        release: `clinicflow-backend@${process.env.npm_package_version || '1.0.0'}`,
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
        beforeSend: createBeforeSend(),
        beforeSendTransaction: (event) => {
            if (event.request) {
                if (event.request.cookies) event.request.cookies = '[REDACTED]';
                if (event.request.headers) {
                    event.request.headers = Object.fromEntries(
                        Object.entries(event.request.headers).map(([k, v]) =>
                            ['authorization', 'cookie'].includes(k.toLowerCase())
                                ? [k, '[REDACTED]']
                                : [k, v]
                        )
                    );
                }
            }
            return event;
        }
    });
}

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Webhook rate limiter
const webhookLimiter = rateLimit({ windowMs: 60000, max: 30, message: { error: 'Too many webhook requests' } });

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again later.' }
});


const cookieParser = require('cookie-parser');
const { connection } = require('./services/queueService');

const app = express();
const port = process.env.PORT || 4000;

// Security headers — must be early
app.use(helmet({
    crossOriginEmbedderPolicy: false, // allow embedding for patient booking page
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// MUST BE FIRST - capture raw body for HMAC verification before any parsing
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request ID middleware — attaches a unique ID to every request for tracing
app.use((req, res, next) => {
    req.requestId = req.headers['x-request-id'] || require('crypto').randomBytes(8).toString('hex');
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

// Prometheus metrics middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        // Skip metrics endpoint itself to avoid recursion
        if (req.path !== '/metrics') {
            metrics.recordHttpRequest(req.method, req.route?.path || req.path, res.statusCode, duration);
        }
    });
    next();
});

const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175'
        ].filter(Boolean);

        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else if (process.env.NODE_ENV === 'development') {
            const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
            if (isLocal) return callback(null, true);
            callback(new Error('Origin not allowed in development'));
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));






// Trust Render/proxy headers for rate limiting
app.set('trust proxy', 1);




const { verifyToken } = require('./services/authService');
const asyncHandler = require('./middleware/asyncHandler');
const redact = require('./middleware/redact');
const { requireAuth: requireAuthMiddleware } = require('./middleware/requireAuth');
const { attachBilling, trialGuard } = require('./middleware/planGate');
const metrics = require('./utils/metrics');

// --- SAAS MIDDLEWARE ---

// Use the extracted requireAuth from middleware/requireAuth.js
const requireAuth = requireAuthMiddleware;

const ROLE_HIERARCHY = ['ASSISTANT', 'RECEPTIONIST', 'DOCTOR', 'ADMIN', 'OWNER'];
const AUTOMATION_ROLE = 'AUTOMATION'; // Special role for API-key authenticated requests

const requireRole = (role) => {
    return (req, res, next) => {
        // Automation role bypasses role checks (it's a machine account)
        if (req.user?.role === AUTOMATION_ROLE) return next();

        const userRoleIndex = ROLE_HIERARCHY.indexOf(req.user?.role);
        const requiredRoleIndex = ROLE_HIERARCHY.indexOf(role);
        if (userRoleIndex < requiredRoleIndex) {
            throw new AppError('FORBIDDEN', 'Forbidden: Insufficient permissions', 403);
        }
        next();
    };
};

// Admin middleware for global control
const requireAdmin = [requireAuth, requireRole('ADMIN')];



// --- ROUTES ---

// Public / Health — returns minimal info to unauthenticated callers
app.get('/api/health', async (req, res) => {
    const checks = {
        status: 'ok',
        uptime: process.uptime(),
        db: 'unknown',
        redis: 'unknown',
        timestamp: new Date().toISOString()
    };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = 'ok';
    } catch (e) {
        checks.db = 'error';
        checks.status = 'degraded';
    }
    try {
        const { connection } = require('./services/queueService');
        checks.redis = connection && connection.status === 'ready' ? 'ok' : 'disabled';
    } catch {
        checks.redis = 'disabled';
    }
    res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', metrics.register.contentType);
        res.end(await metrics.register.metrics());
    } catch (err) {
        res.status(500).send('Metrics error');
    }
});

// Detailed health — requires platform admin auth, returns service config status
app.get('/api/health/detailed', requireAdmin, async (req, res) => {
    const checks = {
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        db: 'unknown',
        redis: 'unknown',
        env: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        services: {
            stripe: Boolean(process.env.STRIPE_SECRET_KEY),
            twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
            vapi: Boolean(process.env.VAPI_API_KEY || process.env.VAPI_WEBHOOK_SECRET),
            gemini: Boolean(process.env.GEMINI_API_KEY),
            sentry: Boolean(process.env.SENTRY_BACKEND_DSN)
        },
        timestamp: new Date().toISOString()
    };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = 'ok';
    } catch (e) {
        checks.db = 'error';
        checks.dbError = e.message;
        checks.status = 'degraded';
    }
    try {
        const { connection } = require('./services/queueService');
        checks.redis = connection && connection.status === 'ready' ? 'ok' : 'disabled';
    } catch {
        checks.redis = 'disabled';
    }
    res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});

// Apply general rate limit to all /api routes
app.use('/api', apiLimiter);

// API Versioning middleware
const API_VERSION = 'v1';
app.use('/api', (req, res, next) => {
    res.setHeader('API-Version', API_VERSION);
    res.setHeader('API-Deprecation-Warning', 'false');
    next();
});

// Auth - rate limited
const authRouter = require('./routes/auth');
app.use('/api/auth', authLimiter, authRouter);

// Admin (Protected)
const adminRouter = require('./routes/admin');
app.use('/api/admin', adminRouter);

// Clinic Scoped Routes
const analysisRouter = require('./routes/analysis');
app.use('/api/analysis', requireAuth, analysisRouter);

const recoveryRouter = require('./routes/recovery');
app.use('/api/recovery', requireAuth, requireRole('RECEPTIONIST'), redact, recoveryRouter);

const testRouter = require('./routes/test');
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', requireAdmin, testRouter);
}

const teamRouter = require('./routes/team');
app.use('/api/team', requireAuth, attachBilling, trialGuard, teamRouter);

const doctorsRouter = require('./routes/doctors');
app.use('/api/doctors', requireAuth, attachBilling, trialGuard, doctorsRouter);

// Unauthenticated Webhooks (Self-protected via HMAC inside)
// --- REVENUE RECOVERY ROUTES (handled by recoveryRouter above) ---

// --- TWILIO STATUS CALLBACK (verified via X-Twilio-Signature) ---
const crypto = require('crypto');

function verifyTwilioSignature(req) {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token) {
        // In dev, allow unsigned; in production refuse
        return process.env.NODE_ENV !== 'production';
    }
    const signature = req.headers['x-twilio-signature'];
    if (!signature) return false;

    // Twilio signs URL + sorted POST params (key+value concatenated), HMAC-SHA1, base64
    const url = `${process.env.BACKEND_API_URL || ''}${req.originalUrl}`;
    const params = req.body && typeof req.body === 'object' ? req.body : {};
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const k of sortedKeys) {
        data += k + String(params[k] ?? '');
    }
    const expected = crypto.createHmac('sha1', token).update(data).digest('base64');
    try {
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
        return false;
    }
}

app.post('/api/webhook/sms-status', express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
    if (!verifyTwilioSignature(req)) {
        logger.warn('Twilio status callback signature invalid', { ip: req.ip, sid: req.body?.MessageSid });
        return res.sendStatus(403);
    }
    const { MessageSid, MessageStatus, To, ErrorCode } = req.body;
    logger.info('Twilio status callback', { status: MessageStatus, sid: MessageSid, to: To });
    if (MessageSid && MessageStatus) {
        await prisma.messageLog.updateMany({
            where: { providerMessageSid: MessageSid },
            data: {
                status: MessageStatus === 'delivered' ? 'DELIVERED' :
                        ['failed','undelivered'].includes(MessageStatus) ? 'FAILED' : 'SENT',
                providerStatusRaw: `twilio_${MessageStatus}${ErrorCode ? `_${ErrorCode}` : ''}`
            }
        }).catch(err => logger.warn('Twilio status update failed', { err }));
    }
    res.sendStatus(200);
}));

// --- WEBHOOK ROUTES ---
const webhooksRouter = require('./routes/webhooks');
app.use('/api/webhook', webhookLimiter, webhooksRouter);

// --- PUBLIC ROUTES (No Auth) ---
const publicRouter = require('./routes/public');
app.use('/api/public', publicRouter);

// --- BILLING (Stripe) ---
// Note: the billing router performs its own auth + role checks, except the
// webhook endpoint which is verified via Stripe signature.
const billingRouter = require('./routes/billing');
app.use('/api/billing', webhookLimiter, billingRouter);

const automationAuth = require('./middleware/automationAuth');
const automationRouter = require('./routes/automation');
app.use('/api/automation', automationAuth, automationRouter);
app.use('/api/leads', require('./routes/leads'));

// Google Calendar callback MUST be registered BEFORE /api routes with requireAuth
// because Google redirects here without a JWT token
const { handleCallback: gcalHandleCallback } = require('./services/googleCalendarService');
// Safe error code mapping — never forward raw provider messages to the client
const GCAL_ERROR_CODES = {
    access_denied: 'access_denied',
    invalid_request: 'invalid_request',
    invalid_state: 'invalid_state',
    missing_params: 'missing_params',
    token_exchange_failed: 'token_exchange_failed',
    unknown: 'unknown',
};
function mapGcalError(rawError) {
    if (!rawError) return GCAL_ERROR_CODES.unknown;
    // Only allow known Google OAuth error codes through
    if (Object.keys(GCAL_ERROR_CODES).includes(rawError)) return rawError;
    if (rawError.includes('state')) return GCAL_ERROR_CODES.invalid_state;
    if (rawError.includes('code')) return GCAL_ERROR_CODES.invalid_request;
    return GCAL_ERROR_CODES.unknown;
}

app.get('/api/clinic/google-calendar/callback', asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'https://clinicflow.app';

    logger.info('GoogleCalendar callback received', { hasError: !!error, hasCode: !!code, hasState: !!state });

    if (error) {
        // Sanitize: log the raw error, but only forward a safe code
        logger.error('GoogleCalendar OAuth error', { error });
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=${mapGcalError(error)}`);
    }
    if (!code || !state) {
        logger.error('GoogleCalendar missing code or state');
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=${GCAL_ERROR_CODES.missing_params}`);
    }

    try {
        const stateObj = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        const { nonce, clinicId } = stateObj;
        if (!nonce || !clinicId) {
            logger.error('GoogleCalendar invalid state format');
            return res.redirect(`${frontendUrl}/settings?gcal=error&reason=${GCAL_ERROR_CODES.invalid_state}`);
        }

        await gcalHandleCallback(code, clinicId, nonce);
        logger.info('GoogleCalendar successfully connected', { clinicId });
        res.redirect(`${frontendUrl}/settings?gcal=connected`);
    } catch (err) {
        // Log full error internally; send only a safe code to the client
        logger.error('GoogleCalendar callback error', { err });
        const safeReason = err.message?.includes('state') || err.message?.includes('CSRF')
            ? GCAL_ERROR_CODES.invalid_state
            : GCAL_ERROR_CODES.token_exchange_failed;
        res.redirect(`${frontendUrl}/settings?gcal=error&reason=${safeReason}`);
    }
}));

// Standard Clinic API
const appointmentsRouter = require('./routes/appointments');
app.use('/api', requireAuth, attachBilling, trialGuard, redact, appointmentsRouter);

const clinicRouter = require('./routes/clinic');
// POST /api/clinic is admin-only; settings/ai-config require owner — enforced per-route in clinic.js
app.use('/api/clinic', requireAuth, attachBilling, trialGuard, clinicRouter);

// Google Calendar routes (except callback which is above)
const googleCalendarRouter = require('./routes/googleCalendar');
app.use('/api/clinic/google-calendar', requireAuth, googleCalendarRouter);

const systemRouter = require('./routes/system');
app.use('/api/system', requireAuth, systemRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', requireAuth, requireRole('RECEPTIONIST'), notificationsRouter);

const auditLogsRouter = require('./routes/auditLogs');
app.use('/api/audit-logs', requireAuth, auditLogsRouter);

const messagesRouter = require('./routes/messages');
app.use('/api/messages', requireAuth, attachBilling, trialGuard, messagesRouter);

const activityFeedRouter = require('./routes/activityFeed');
app.use('/api/activity-feed', requireAuth, attachBilling, trialGuard, requireRole('RECEPTIONIST'), activityFeedRouter);

// AI Command endpoint
const aiCommandRouter = require('./routes/aiCommand');
app.use('/api/ai', requireAuth, attachBilling, trialGuard, aiCommandRouter);

// Vapi voice AI webhook endpoint
const vapiRouter = require('./routes/vapi');
app.use('/api/vapi', vapiRouter);

// Automation endpoints — callable by n8n / Make via x-api-key or Bearer JWT
// --- 404 HANDLER (MUST BE AFTER ALL ROUTES) ---
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        code: 'ROUTE_NOT_FOUND',
        message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`
    });
});

// Sentry error handler — must be before the global error handler
if (process.env.SENTRY_BACKEND_DSN) {
    Sentry.setupExpressErrorHandler(app);
}

// Global error handler — catches anything forwarded via next(err) or asyncHandler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    logger.error(`${req.method} ${req.url} failed`, {
        err,
        userId: req.user?.userId,
        clinicId: req.clinicId
    });
    const status = err.status || err.statusCode || 500;
    if (err.code === 'USAGE_LIMIT_REACHED') {
        return res.status(429).json({
            error: 'USAGE_LIMIT_REACHED',
            type: err.details?.type || 'sms'
        });
    }
    if (err.code === 'SMS_SEND_FAILED') {
        return res.status(502).json({
            error: 'SMS_SEND_FAILED',
            type: 'sms',
            message: err.details?.reason || 'SMS provider failed'
        });
    }
    if (err.code === 'RATE_LIMITED') {
        return res.status(429).json({
            error: 'RATE_LIMITED',
            type: err.details?.type || 'sms'
        });
    }
    if (err.code === 'AI_PROVIDER_ERROR') {
        return res.status(502).json({
            error: 'AI_PROVIDER_ERROR',
            type: 'ai',
            message: err.message
        });
    }
    if (err.code === 'BILLING_LOCKED') {
        return res.status(402).json({
            error: 'BILLING_LOCKED',
            message: err.message,
            plan: err.details?.plan,
            planStatus: err.details?.planStatus,
            trialEndsAt: err.details?.trialEndsAt,
        });
    }
    if (err.code === 'PLAN_UPGRADE_REQUIRED') {
        return res.status(402).json({
            error: 'PLAN_UPGRADE_REQUIRED',
            message: err.message,
            currentPlan: err.details?.currentPlan,
            requiredPlan: err.details?.requiredPlan,
        });
    }
    if (err.code === 'BILLING_NOT_CONFIGURED') {
        return res.status(503).json({
            error: 'BILLING_NOT_CONFIGURED',
            message: err.message,
        });
    }
    // Known AppError codes — safe to expose to client
    const SAFE_CLIENT_CODES = new Set([
        'USAGE_LIMIT_REACHED', 'SMS_SEND_FAILED', 'RATE_LIMITED',
        'AI_PROVIDER_ERROR', 'BILLING_LOCKED', 'PLAN_UPGRADE_REQUIRED',
        'BILLING_NOT_CONFIGURED', 'FORBIDDEN', 'UNAUTHORIZED',
        'NOT_FOUND', 'CONFLICT', 'VALIDATION_ERROR', 'REGISTRATION_DISABLED',
        'REFRESH_TOKEN_MISSING', 'INVALID_REFRESH_TOKEN', 'INVALID_TOKEN',
        'AUTH_FAILED', 'ACCOUNT_LOCKED', 'INTERNAL_ERROR', 'REFRESH_FAILED',
        'SERVICE_UNAVAILABLE', 'CONFIGURATION_ERROR',
    ]);

    const clientMessage = SAFE_CLIENT_CODES.has(err.code) && status < 500
        ? err.message
        : 'Internal server error';

    res.status(status).json({
        error: clientMessage,
        code: SAFE_CLIENT_CODES.has(err.code) ? err.code : 'INTERNAL_ERROR'
    });
});

// Graceful shutdown — finish in-flight requests before exiting
const { getZadarmaSecret } = require('./middleware/webhookAuth');

// Start server after DB connection is confirmed
prisma.connectWithRetry().then(() => {
    server = app.listen(port, () => {
        logger.info(`SaaS Backend running on port ${port}`);

    // Zadarma webhook URL — print the full URL to stderr so the operator can
    // paste it into the Zadarma panel.  Never log it via the structured logger
    // because the URL contains the webhook secret as a path segment.
    const zadarmaSecret = getZadarmaSecret();
    const zadarmaUrl = `${process.env.BACKEND_API_URL || `https://<your-backend>.onrender.com`}/api/webhook/zadarma/${zadarmaSecret}`;
    const zadarmaSource = process.env.ZADARMA_WEBHOOK_SECRET ? 'from env' : 'AUTO-GENERATED — set ZADARMA_WEBHOOK_SECRET in env to keep stable across restarts';
    process.stderr.write(`[ZADARMA] Webhook URL (${zadarmaSource}):\n[ZADARMA] ${zadarmaUrl}\n`);

    // System check — logs all critical config at startup
    logger.info('System Check', {
        db: process.env.DATABASE_URL ? 'configured' : 'missing',
        jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET ? 'configured' : 'missing',
        frontendUrl: process.env.FRONTEND_URL ? 'configured' : 'missing',
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        webhookSecret: process.env.WEBHOOK_SECRET ? 'configured' : 'not set',
        twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ? 'configured' : 'not set (sms-status callbacks will be refused in production)',
        zadarmaWebhookSecret: process.env.ZADARMA_WEBHOOK_SECRET ? 'configured' : 'auto-generated this process',
        redis: process.env.DISABLE_REDIS === 'true' ? 'disabled' : (process.env.REDIS_URL ? 'configured' : 'missing'),
        worker: process.env.DISABLE_WORKER === 'true' ? 'disabled' : 'running',
        port,
        node: process.version,
        env: process.env.NODE_ENV || 'development'
    });
});

function gracefulShutdown(signal) {
    logger.info(`Received ${signal}. Draining connections...`);

    const finishShutdown = async () => {
        try {
            // Stop background worker
            if (global.worker) {
                logger.info('Stopping background worker...');
                await global.worker.stop?.();
            }

            // Disconnect Prisma
            await prisma.$disconnect();
            logger.info('Database disconnected. Exiting.');
            process.exit(0);
        } catch (err) {
            logger.error('Shutdown cleanup failed', { err });
            process.exit(1);
        }
    };

    if (!server) {
        return finishShutdown();
    }

    // Stop accepting new connections
    server.close(async () => {
        logger.info('HTTP server closed.');
        await finishShutdown();
    });

    // Force exit after 10s if connections don't drain
    setTimeout(() => {
        logger.error('Force exit after 10s timeout.');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Global uncaught exception / rejection handlers — registered after gracefulShutdown is defined
process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT_EXCEPTION — Process will exit', { err });
    if (process.env.SENTRY_BACKEND_DSN) {
        Sentry.captureException(err, { level: 'fatal' });
    }
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
    logger.warn('UNHANDLED_REJECTION', { err: reason instanceof Error ? reason : new Error(String(reason)) });
});

// Start background worker by default (disable with DISABLE_WORKER=true)
if (process.env.DISABLE_WORKER !== 'true') {
    logger.info('Starting background worker for reminders and follow-ups...');
    global.worker = require('./worker');
} else {
    logger.warn('Background worker is DISABLED. No automated reminders will be sent.');
}

});
