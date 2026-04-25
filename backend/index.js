require('dotenv').config();
const { validateEnv } = require('./utils/envValidator');

// Fail fast if critical environment variables are missing
if (!validateEnv()) {
    console.error('FATAL: Required environment variables are missing. Refusing to start.');
    process.exit(1);
}

const Sentry = require("@sentry/node");

const prisma = require('./services/prisma');

if (process.env.SENTRY_BACKEND_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_BACKEND_DSN,
        tracesSampleRate: 1.0,
    });
}

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

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
const { reminderWorker, connection } = require('./services/queueService');

const app = express();
const port = process.env.PORT || 4000;

// MUST BE FIRST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
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

// --- SAAS MIDDLEWARE ---

const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded; // { userId, clinicId, role }
    req.clinicId = decoded.clinicId;

    // Optional: Hydrate clinic info if needed
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    req.clinic = clinic;

    next();
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};

// Admin middleware for global control
const requireAdmin = [requireAuth, requireRole('ADMIN')];



// --- ROUTES ---

// Public / Health
app.get('/api/health', async (req, res) => {
    const checks = { status: 'ok', db: 'unknown', redis: 'unknown' };
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = 'ok';
    } catch {
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

// Apply general rate limit to all /api routes
app.use('/api', apiLimiter);

// Auth - rate limited
const authRouter = require('./routes/auth');
app.use('/api/auth', authLimiter, authRouter);

// Admin (Protected)
const adminRouter = require('./routes/admin');
app.use('/api/admin', requireAdmin, adminRouter);

// Clinic Scoped Routes
const analysisRouter = require('./routes/analysis');
app.use('/api/analysis', requireAuth, analysisRouter);

const recoveryRouter = require('./routes/recovery');
app.use('/api/recovery', requireAuth, recoveryRouter);

const testRouter = require('./routes/test');
app.use('/api/test', requireAdmin, testRouter);

const teamRouter = require('./routes/team');
app.use('/api/team', requireAuth, teamRouter);

// Unauthenticated Webhooks (Self-protected via HMAC inside)
// --- REVENUE RECOVERY ROUTES (handled by recoveryRouter above) ---

// --- WEBHOOK ROUTES ---
const webhookAuth = require('./middleware/webhookAuth');
const webhooksRouter = require('./routes/webhooks');
app.use('/api/webhook', webhookLimiter, webhookAuth, webhooksRouter);
app.use('/api/webhooks', webhookLimiter, webhookAuth, webhooksRouter);

// --- PUBLIC ROUTES (No Auth) ---
const publicRouter = require('./routes/public');
app.use('/api/public', publicRouter);

const automationAuth = require('./middleware/automationAuth');
const automationRouter = require('./routes/automation');
app.use('/api/automation', automationAuth, automationRouter);

// Standard Clinic API
const appointmentsRouter = require('./routes/appointments');
app.use('/api', requireAuth, appointmentsRouter);

const clinicRouter = require('./routes/clinic');
// POST /api/clinic is admin-only; settings/ai-config require owner — enforced per-route in clinic.js
app.use('/api/clinic', requireAuth, clinicRouter);

const systemRouter = require('./routes/system');
app.use('/api/system', requireAuth, systemRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', requireAuth, notificationsRouter);

const auditLogsRouter = require('./routes/auditLogs');
app.use('/api/audit-logs', requireAuth, auditLogsRouter);

const messagesRouter = require('./routes/messages');
app.use('/api/messages', requireAuth, messagesRouter);

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
    console.error(`[ERROR] ${req.method} ${req.url} —`, err.message || err);
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
    res.status(status).json({
        error: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR'
    });
});

app.listen(port, () => {
    console.log(`SaaS Backend running on port ${port}`);

    // System check — logs all critical config at startup
    console.log('\n=== System Check ===');
    console.log(`  DB:             ${process.env.DATABASE_URL                                          ? '✅ OK' : '❌ Missing DATABASE_URL'}`);
    console.log(`  JWT Secret:     ${process.env.JWT_SECRET                                            ? '✅ OK' : '⚠  Using insecure default'}`);
    console.log(`  Gemini AI:      ${process.env.GEMINI_API_KEY                                        ? '✅ OK' : '⚠  Missing GEMINI_API_KEY'}`);
    console.log(`  Webhook Secret: ${process.env.WEBHOOK_SECRET                                        ? '✅ OK' : '⚠  Not set — webhook endpoint unprotected'}`);
    console.log(`  Redis:          ${process.env.DISABLE_REDIS === 'true'                              ? '⚠  Disabled (DISABLE_REDIS=true)' : (process.env.REDIS_URL ? '✅ OK' : '⚠  Missing REDIS_URL')}`);
    console.log(`  Worker:         ✅ Running (embedded)`);
    console.log(`  Port:           ${port}`);
    console.log(`  Node:           ${process.version}`);
    console.log(`  Env:            ${process.env.NODE_ENV || 'development'}`);

    // DB connectivity check
    prisma.$queryRaw`SELECT 1`
        .then(() => console.log(`  DB Connection:  ✅ Connected`))
        .catch(e => console.error(`  DB Connection:  ❌ FAILED — ${e.message}`));
    console.log('====================\n');
});

// Fix 1: Auto-start worker in same process
require('./worker');
