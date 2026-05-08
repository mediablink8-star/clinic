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

const requireAuth = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.userId) {
        throw new AppError('UNAUTHORIZED', 'Invalid or expired token', 401);
    }

    req.user = decoded; // { userId, clinicId, role }
    req.clinicId = decoded.clinicId;

    // Check clinic is active
    const clinic = await prisma.clinic.findUnique({ where: { id: req.clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('FORBIDDEN', 'Clinic account is deactivated', 403);
    req.clinic = clinic;

    next();
});

const ROLE_HIERARCHY = ['ASSISTANT', 'RECEPTIONIST', 'ADMIN', 'OWNER'];

const requireRole = (role) => {
    return (req, res, next) => {
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
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', requireAdmin, testRouter);
}

const teamRouter = require('./routes/team');
app.use('/api/team', requireAuth, teamRouter);

// Unauthenticated Webhooks (Self-protected via HMAC inside)
// --- REVENUE RECOVERY ROUTES (handled by recoveryRouter above) ---

// --- WEBHOOK ROUTES ---
const webhookAuth = require('./middleware/webhookAuth');
const webhooksRouter = require('./routes/webhooks');
app.use('/api/webhook', webhookLimiter, webhookAuth, webhooksRouter);

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

// AI Command endpoint
const aiCommandRouter = require('./routes/aiCommand');
app.use('/api/ai', requireAuth, aiCommandRouter);

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
    console.info(`SaaS Backend running on port ${port}`);

    // System check — logs all critical config at startup
    console.info('\n=== System Check ===');
    console.info(`  DB:             ${process.env.DATABASE_URL                                          ? '✅ OK' : '❌ Missing DATABASE_URL'}`);
    console.info(`  JWT Secret:     ${process.env.JWT_SECRET                                            ? '✅ OK' : '⚠  Using insecure default'}`);
    console.info(`  Gemini AI:      ${process.env.GEMINI_API_KEY                                        ? '✅ OK' : '⚠  Missing GEMINI_API_KEY'}`);
    console.info(`  Webhook Secret: ${process.env.WEBHOOK_SECRET                                        ? '✅ OK' : '⚠  Not set — webhook endpoint unprotected'}`);
    console.info(`  Redis:          ${process.env.DISABLE_REDIS === 'true'                              ? '⚠  Disabled (DISABLE_REDIS=true)' : (process.env.REDIS_URL ? '✅ OK' : '⚠  Missing REDIS_URL')}`);
    console.info(`  Worker:         ${process.env.DISABLE_WORKER === 'true'                             ? '⚠  Disabled (DISABLE_WORKER=true)' : '✅ Running (embedded)'}`);
    console.info(`  Port:           ${port}`);
    console.info(`  Node:           ${process.version}`);
    console.info(`  Env:            ${process.env.NODE_ENV || 'development'}`);

    // DB connectivity check
    prisma.$queryRaw`SELECT 1`
        .then(() => console.info(`  DB Connection:  ✅ Connected`))
        .catch(e => console.error(`  DB Connection:  ❌ FAILED — ${e.message}`));
    console.info('====================\n');
});

// Start background worker by default (disable with DISABLE_WORKER=true)
if (process.env.DISABLE_WORKER !== 'true') {
    console.info('[WORKER] Starting background worker for reminders and follow-ups...');
    require('./worker');
} else {
    console.warn('[WORKER] Background worker is DISABLED. No automated reminders will be sent.');
}
