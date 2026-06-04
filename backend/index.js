require('dotenv').config();
const { validateEnv } = require('./utils/envValidator');

// Fail fast if critical environment variables are missing
if (!validateEnv()) {
    console.error('FATAL: Required environment variables are missing. Refusing to start.');
    process.exit(1);
}

const logger = require('./utils/logger');
const Sentry = require("@sentry/node");
let server = null;

// Global uncaught exception / rejection handlers — prevents process crashes
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
    Sentry.init({
        dsn: process.env.SENTRY_BACKEND_DSN,
        tracesSampleRate: 0.1,
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

        if (allowedOrigins.indexOf(origin) !== -1 || (process.env.NODE_ENV === 'development' && !origin)) {
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

// Public / Health
app.get('/api/health', async (req, res) => {
    const checks = { 
        status: 'ok', 
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        db: 'unknown', 
        redis: 'unknown',
        env: process.env.NODE_ENV || 'development'
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
app.use('/api/recovery', requireAuth, requireRole('DOCTOR'), redact, recoveryRouter);

const testRouter = require('./routes/test');
if (process.env.NODE_ENV !== 'production') {
    app.use('/api/test', requireAdmin, testRouter);
}

const teamRouter = require('./routes/team');
app.use('/api/team', requireAuth, teamRouter);

const doctorsRouter = require('./routes/doctors');
app.use('/api/doctors', requireAuth, doctorsRouter);

// Unauthenticated Webhooks (Self-protected via HMAC inside)
// --- REVENUE RECOVERY ROUTES (handled by recoveryRouter above) ---

// --- TWILIO STATUS CALLBACK (no auth, Twilio calls directly with urlencoded body) ---
app.post('/api/webhook/sms-status', express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
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

const automationAuth = require('./middleware/automationAuth');
const automationRouter = require('./routes/automation');
app.use('/api/automation', automationAuth, automationRouter);

// Google Calendar callback MUST be registered BEFORE /api routes with requireAuth
// because Google redirects here without a JWT token
const { handleCallback: gcalHandleCallback } = require('./services/googleCalendarService');
app.get('/api/clinic/google-calendar/callback', asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'https://clinicflow.app';
    
    logger.info('GoogleCalendar callback received', { hasError: !!error, hasCode: !!code, hasState: !!state });
    
    if (error) {
        logger.error('GoogleCalendar OAuth error', { error });
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=${encodeURIComponent(error)}`);
    }
    if (!code || !state) {
        logger.error('GoogleCalendar missing code or state');
        return res.redirect(`${frontendUrl}/settings?gcal=error&reason=missing_params`);
    }

    try {
        const stateObj = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
        const { nonce, clinicId } = stateObj;
        if (!nonce || !clinicId) {
            logger.error('GoogleCalendar invalid state format');
            return res.redirect(`${frontendUrl}/settings?gcal=error&reason=invalid_state`);
        }

        await gcalHandleCallback(code, clinicId, nonce);
        logger.info('GoogleCalendar successfully connected', { clinicId });
        res.redirect(`${frontendUrl}/settings?gcal=connected`);
    } catch (err) {
        logger.error('GoogleCalendar callback error', { err });
        res.redirect(`${frontendUrl}/settings?gcal=error&reason=${encodeURIComponent(err.message)}`);
    }
}));

// Standard Clinic API
const appointmentsRouter = require('./routes/appointments');
app.use('/api', requireAuth, redact, appointmentsRouter);

const clinicRouter = require('./routes/clinic');
// POST /api/clinic is admin-only; settings/ai-config require owner — enforced per-route in clinic.js
app.use('/api/clinic', requireAuth, clinicRouter);

// Google Calendar routes (except callback which is above)
const googleCalendarRouter = require('./routes/googleCalendar');
app.use('/api/clinic/google-calendar', requireAuth, googleCalendarRouter);

const systemRouter = require('./routes/system');
app.use('/api/system', requireAuth, systemRouter);

const notificationsRouter = require('./routes/notifications');
app.use('/api/notifications', requireAuth, requireRole('DOCTOR'), notificationsRouter);

const auditLogsRouter = require('./routes/auditLogs');
app.use('/api/audit-logs', requireAuth, auditLogsRouter);

const messagesRouter = require('./routes/messages');
app.use('/api/messages', requireAuth, messagesRouter);

const activityFeedRouter = require('./routes/activityFeed');
app.use('/api/activity-feed', requireAuth, requireRole('DOCTOR'), activityFeedRouter);

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
    res.status(status).json({
        error: err.message || 'Internal server error',
        code: err.code || 'INTERNAL_ERROR'
    });
});

// Graceful shutdown — finish in-flight requests before exiting
server = app.listen(port, () => {
    logger.info(`SaaS Backend running on port ${port}`);

    // System check — logs all critical config at startup
    logger.info('System Check', {
        db: process.env.DATABASE_URL ? 'configured' : 'missing',
        jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
        refreshSecret: process.env.REFRESH_TOKEN_SECRET ? 'configured' : 'missing',
        frontendUrl: process.env.FRONTEND_URL ? 'configured' : 'missing',
        gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing',
        webhookSecret: process.env.WEBHOOK_SECRET ? 'configured' : 'not set',
        redis: process.env.DISABLE_REDIS === 'true' ? 'disabled' : (process.env.REDIS_URL ? 'configured' : 'missing'),
        worker: process.env.DISABLE_WORKER === 'true' ? 'disabled' : 'running',
        port,
        node: process.version,
        env: process.env.NODE_ENV || 'development'
    });

    // DB connectivity check
    prisma.$queryRaw`SELECT 1`
        .then(() => logger.info('DB Connection: connected'))
        .catch(e => logger.error('DB Connection: failed', { err: e }));
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

// Start background worker by default (disable with DISABLE_WORKER=true)
if (process.env.DISABLE_WORKER !== 'true') {
    logger.info('Starting background worker for reminders and follow-ups...');
    global.worker = require('./worker');
} else {
    logger.warn('Background worker is DISABLED. No automated reminders will be sent.');
}
