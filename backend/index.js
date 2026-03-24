const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

require('dotenv').config();

/*
Sentry.init({
    dsn: process.env.SENTRY_BACKEND_DSN || "https://placeholder@sentry.io/123",
    integrations: [
        nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
});
*/

const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

// Webhook rate limiter
const webhookLimiter = rateLimit({ windowMs: 60000, max: 30, message: { error: 'Too many webhook requests' } });
const cookieParser = require('cookie-parser');
const { triggerWebhook } = require('./services/webhookService');
const { checkWorkingHours } = require('./services/workingHours');
const { logAction } = require('./services/auditService');
const { encrypt, decrypt } = require('./services/encryptionService');
const { reminderWorker, connection } = require('./services/queueService');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 4000;

// MUST BE FIRST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.static('public'));

/*
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased for development/testing
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);
*/

// Debug Logging After Parsing
app.use((req, res, next) => {
    if (req.url === '/api/auth/login') {
        console.log(`[DEBUG] Login Attempt - Content-Type: ${req.headers['content-type']}`);
        console.log(`[DEBUG] Body:`, JSON.stringify(req.body));
    }
    next();
});

const { verifyToken } = require('./services/authService');
const { validate, clinicUpdateSchema, clinicInfoSchema, aiConfigSchema } = require('./services/validationService');
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

// Owner middleware — clinic-level owner or system admin
const requireOwner = (req, res, next) => {
    if (!req.user || !['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
    }
    next();
};

// --- ROUTES ---

// Public / Health
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Admin (Protected)
app.get('/api/admin/usage', requireAdmin, asyncHandler(async (req, res) => {
    const usage = await prisma.clinic.findMany({
        select: { id: true, name: true, messageCredits: true, monthlyCreditLimit: true, dailyUsedCount: true, dailyMessageCap: true, creditResetDate: true }
    });
    res.json(usage);
}));

app.get('/api/admin/logs', requireAdmin, asyncHandler(async (req, res) => {
    const logs = await prisma.messageLog.findMany({
        take: 50, orderBy: { timestamp: 'desc' }, include: { clinic: { select: { name: true } } }
    });
    res.json(logs);
}));

app.post('/api/admin/add-credits', requireAdmin, asyncHandler(async (req, res) => {
    const { clinicId, amount } = req.body;
    const clinic = await prisma.clinic.update({ where: { id: clinicId }, data: { messageCredits: { increment: parseInt(amount) } } });
    res.json({ success: true, newBalance: clinic.messageCredits });
}));

// Clinic Scoped Routes
const analysisRouter = require('./routes/analysis');
app.use('/api/analysis', requireAuth, analysisRouter);

const recoveryRouter = require('./routes/recovery');
app.use('/api/recovery', requireAuth, recoveryRouter);

const testRouter = require('./routes/test');
app.use('/api/test', requireAdmin, testRouter);

// Integrations (Protected)
const integrationsRouter = require('./routes/integrations');
app.use('/api/integrations', requireAuth, integrationsRouter);

const teamRouter = require('./routes/team');
app.use('/api/team', requireAuth, teamRouter);

// Unauthenticated Webhooks (Self-protected via HMAC inside)
const voiceRouter = require('./routes/voice');
const webhookAuth = require('./middleware/webhookAuth');
app.use('/api/voice', voiceRouter);

// --- REVENUE RECOVERY ROUTES (handled by recoveryRouter above) ---

// --- TEST / DEMO ROUTES ---
app.post('/api/webhook/missed-call', webhookLimiter, webhookAuth, asyncHandler(async (req, res) => {
    const { phone = '+30690000000', clinicId, callSid } = req.body;

    if (!clinicId) return res.status(400).json({ error: 'clinicId is required' });

    // Fix 4 — Dedup by callSid
    if (callSid) {
        const existing = await prisma.missedCall.findFirst({ where: { callSid } });
        if (existing) {
            return res.json({ success: true, duplicate: true, missedCallId: existing.id });
        }
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });

    // --- Working Hours Check ---
    const aiConfig = JSON.parse(clinic.aiConfig || '{}');
    const workingHours = aiConfig.workingHours || null;
    const now = new Date();
    const { withinHours, scheduledAt } = checkWorkingHours(now, workingHours);

    // Fix 5 — Create with smsStatus: pending
    const missedCall = await prisma.missedCall.create({
        data: {
            clinicId,
            fromNumber: phone,
            callSid: callSid || null,
            status: 'RECOVERING',
            smsStatus: withinHours ? 'pending' : 'scheduled',
            scheduledSmsAt: withinHours ? null : scheduledAt,
            estimatedRevenue: 80
        }
    });

    if (!withinHours) {
        // Outside working hours — SMS will be sent at scheduledAt by the cron job
        const fmt = scheduledAt.toLocaleString('el-GR', { timeZone: 'Europe/Athens', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        console.log(`[WorkingHours] Outside hours — SMS for ${phone} scheduled at ${fmt}`);
        return res.json({ success: true, missedCallId: missedCall.id, scheduled: true, scheduledAt });
    }

    // Mark as processing before triggering
    await prisma.missedCall.update({
        where: { id: missedCall.id },
        data: { smsStatus: 'processing' }
    });

    if (clinic.webhookUrl) {
        try {
            const result = await triggerWebhook('missed_call.detected', {
                phone,
                missedCallId: missedCall.id,
                clinicId
            }, clinic.webhookUrl, clinic.webhookSecret, { maxRetries: 3, baseDelay: 500 });

            if (result.success) {
                await prisma.missedCall.update({
                    where: { id: missedCall.id },
                    data: { smsStatus: 'sent', lastSmsSentAt: new Date() }
                });
            } else {
                await prisma.missedCall.update({
                    where: { id: missedCall.id },
                    data: { smsStatus: 'failed', smsError: result.error || 'Webhook failed' }
                });
            }
        } catch (webhookErr) {
            await prisma.missedCall.update({
                where: { id: missedCall.id },
                data: { smsStatus: 'failed', smsError: webhookErr.message }
            });
        }
    } else {
        await prisma.missedCall.update({
            where: { id: missedCall.id },
            data: { smsStatus: 'pending' }
        });
    }

    res.json({ success: true, missedCallId: missedCall.id });
}));

// --- PUBLIC ROUTES (No Auth) ---

app.get('/api/public/clinic/:id', asyncHandler(async (req, res) => {
    const clinic = await prisma.clinic.findUnique({
        where: { id: req.params.id },
        select: { name: true, location: true, phone: true, email: true, workingHours: true, services: true, policies: true, avatarUrl: true }
    });
    if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
    res.json({
        ...clinic,
        workingHours: JSON.parse(clinic.workingHours),
        services: JSON.parse(clinic.services),
        policies: JSON.parse(clinic.policies)
    });
}));

app.post('/api/public/book', asyncHandler(async (req, res) => {
    const { clinicId, name, phone, email, reason, startTime } = req.body;

    let patient = await prisma.patient.findFirst({ where: { clinicId, phone } });
    if (!patient) {
        patient = await prisma.patient.create({ data: { clinicId, name, phone, email } });
    }

    const start = new Date(startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const appointment = await prisma.appointment.create({
        data: { clinicId, patientId: patient.id, startTime: start, endTime: end, reason, status: 'PENDING' }
    });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (clinic && clinic.webhookUrl) {
        const pt = await prisma.patient.findFirst({ where: { name, clinicId } });
        triggerWebhook(
            'appointment.created',
            {
                appointmentId: appointment.id,
                patientName: name,
                phone: pt?.phone || '',
                date: start.toISOString().split('T')[0],
                time: start.toISOString().split('T')[1].slice(0, 5),
                reason
            },
            clinic.webhookUrl,
            clinic.webhookSecret
        ).catch(err => console.error('Webhook trigger failed:', err.message));
    }

    res.json({ success: true, appointmentId: appointment.id });
}));

// Standard Clinic API
app.get('/api/patients', requireAuth, asyncHandler(async (req, res) => {
    const patients = await prisma.patient.findMany({ where: { clinicId: req.clinicId }, include: { appointments: true } });
    res.json(patients);
}));

app.get('/api/appointments', requireAuth, asyncHandler(async (req, res) => {
    const appointments = await prisma.appointment.findMany({ where: { clinicId: req.clinicId }, include: { patient: true }, orderBy: { startTime: 'asc' } });
    res.json(appointments);
}));

app.get('/api/clinic', requireAuth, asyncHandler(async (req, res) => {
    const clinic = { ...req.clinic };
    const apiKeys = JSON.parse(clinic.apiKeys || '{}');

    // Mask keys
    const maskedKeys = {};
    if (apiKeys) {
        Object.keys(apiKeys).forEach(key => {
            try {
                const decrypted = decrypt(apiKeys[key]);
                if (decrypted) {
                    maskedKeys[key] = `********${decrypted.slice(-4)}`;
                } else {
                    maskedKeys[key] = '********';
                }
            } catch (e) {
                maskedKeys[key] = '********';
            }
        });
    }

    // Mask webhook secret
    let maskedWebhookSecret = clinic.webhookSecret;
    if (clinic.webhookSecret) {
        try {
            const decSecret = decrypt(clinic.webhookSecret);
            maskedWebhookSecret = decSecret ? `********${decSecret.slice(-4)}` : '********';
        } catch (e) {
            maskedWebhookSecret = '********';
        }
    }

    res.json({
        ...clinic,
        workingHours: JSON.parse(clinic.workingHours),
        services: JSON.parse(clinic.services),
        policies: JSON.parse(clinic.policies),
        webhookSecret: maskedWebhookSecret,
        aiConfig: clinic.aiConfig ? JSON.parse(clinic.aiConfig) : null,
        apiKeys: maskedKeys
    });
});

app.get('/api/clinic/usage', requireAuth, asyncHandler(async (req, res) => {
    try {
        const clinic = await prisma.clinic.findUnique({
            where: { id: req.clinicId },
            select: {
                messageCredits: true,
                monthlyCreditLimit: true,
                dailyUsedCount: true,
                dailyMessageCap: true
            }
        });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const aiRequestsToday = await prisma.auditLog.count({
            where: {
                clinicId: req.clinicId,
                action: 'AI_REQUEST',
                createdAt: {
                    gte: todayStart
                }
            }
        });

        res.json({
            creditsRemaining: clinic.messageCredits,
            monthlyLimit: clinic.monthlyCreditLimit,
            dailyUsed: clinic.dailyUsedCount,
            dailyLimit: clinic.dailyMessageCap,
            aiRequestsToday
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'READ_CLINIC_USAGE',
            entity: 'CLINIC',
            entityId: req.clinicId,
            ipAddress: req.ip
        });
    } catch (e) {
        console.error('Fetch usage failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/system/config-status', requireAuth, asyncHandler(async (req, res) => {
    try {
        const clinic = req.clinic;
        const apiKeys = JSON.parse(clinic.apiKeys || '{}');
        const warnings = [];

        if (!apiKeys.gemini) warnings.push({ key: 'AI', message: 'Το Gemini API key δεν έχει ρυθμιστεί. Η ανάλυση AI δεν θα λειτουργεί.' });
        if (!apiKeys.twilioSid || !apiKeys.twilioToken) warnings.push({ key: 'SMS', message: 'Τα Twilio credentials δεν έχουν ρυθμιστεί. Τα SMS δεν θα αποστέλλονται.' });
        if (!clinic.webhookUrl) warnings.push({ key: 'webhook', message: 'Δεν έχει ρυθμιστεί webhook URL. Η αυτοματοποίηση δεν θα λειτουργεί.' });
        if (!process.env.WEBHOOK_SECRET) warnings.push({ key: 'security', message: 'Δεν έχει οριστεί WEBHOOK_SECRET. Το webhook endpoint είναι ανοιχτό.' });

        res.json({
            AI: !!apiKeys.gemini,
            SMS: !!(apiKeys.twilioSid && apiKeys.twilioToken),
            recovery: !!clinic.webhookUrl,
            webhook: !!process.env.WEBHOOK_SECRET,
            warnings
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/system/status', requireAuth, asyncHandler(async (req, res) => {
    try {
        const clinic = req.clinic;
        const apiKeys = JSON.parse(clinic.apiKeys || '{}');

        res.json({
            redis: connection ? connection.status === 'ready' : false,
            worker: reminderWorker ? reminderWorker.isRunning() : false,
            aiConfigured: !!apiKeys.gemini,
            twilioConfigured: !!(apiKeys.twilioSid && apiKeys.twilioToken),
            voiceConfigured: !!apiKeys.telephony,
            webhookConfigured: !!clinic.webhookUrl
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'READ_SYSTEM_STATUS',
            entity: 'SYSTEM',
            ipAddress: req.ip
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/clinic', requireAdmin, validate(clinicUpdateSchema), asyncHandler(async (req, res) => {
    try {
        const updateData = { ...req.body };

        // Stringify JSON fields if they are objects
        if (updateData.workingHours && typeof updateData.workingHours === 'object') {
            updateData.workingHours = JSON.stringify(updateData.workingHours);
        }
        if (updateData.services && typeof updateData.services === 'object') {
            updateData.services = JSON.stringify(updateData.services);
        }
        if (updateData.policies && typeof updateData.policies === 'object') {
            updateData.policies = JSON.stringify(updateData.policies);
        }

        // Handle API Keys Encryption
        if (updateData.apiKeys && typeof updateData.apiKeys === 'object') {
            const currentKeys = JSON.parse(req.clinic.apiKeys || '{}');
            const newKeys = { ...currentKeys };

            Object.keys(updateData.apiKeys).forEach(key => {
                const value = updateData.apiKeys[key];
                if (value && value !== '********') {
                    newKeys[key] = encrypt(value);
                }
            });
            updateData.apiKeys = JSON.stringify(newKeys);
        }

        const updatedClinic = await prisma.clinic.update({
            where: { id: req.clinicId },
            data: updateData
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_CLINIC_SETTINGS',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: req.body,
            ipAddress: req.ip
        });

        const responseClinic = { ...updatedClinic };
        const finalKeys = JSON.parse(responseClinic.apiKeys || '{}');
        const maskedFinalKeys = {};
        Object.keys(finalKeys).forEach(key => {
            maskedFinalKeys[key] = '********';
        });

        res.json({
            ...responseClinic,
            workingHours: JSON.parse(responseClinic.workingHours),
            services: JSON.parse(responseClinic.services),
            policies: JSON.parse(responseClinic.policies),
            aiConfig: responseClinic.aiConfig ? JSON.parse(responseClinic.aiConfig) : null,
            apiKeys: maskedFinalKeys
        });
    } catch (e) {
        console.error('Update clinic failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/clinic/settings', requireAuth, requireOwner, validate(clinicInfoSchema), asyncHandler(async (req, res) => {
    try {
        const { name, phone, email, location, timezone } = req.body;
        const updatedClinic = await prisma.clinic.update({
            where: { id: req.clinicId },
            data: { name, phone, email, location, timezone }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_CLINIC_INFO',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: { name, phone, email, location, timezone },
            ipAddress: req.ip
        });

        res.json({ success: true, clinic: updatedClinic });
    } catch (e) {
        console.error('Update clinic info failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/clinic/ai-config', requireAuth, requireOwner, validate(aiConfigSchema), asyncHandler(async (req, res) => {
    try {
        const aiConfig = req.body;
        const updatedClinic = await prisma.clinic.update({
            where: { id: req.clinicId },
            data: { aiConfig: JSON.stringify(aiConfig) }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_AI_CONFIG',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: aiConfig,
            ipAddress: req.ip
        });

        res.json({ success: true, aiConfig: JSON.parse(updatedClinic.aiConfig) });
    } catch (e) {
        console.error('Update AI config failed:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/notifications', requireAuth, asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({ where: { clinicId: req.clinicId }, orderBy: { createdAt: 'desc' }, take: 10, include: { appointment: { include: { patient: true } } } });
    res.json(notifications);
});

// --- MUTATION ROUTES WITH AUDITING ---

app.post('/api/appointments', requireAuth, asyncHandler(async (req, res) => {
    try {
        const { patientId, reason, startTime, endTime, priority } = req.body;
        const appointment = await prisma.appointment.create({
            data: {
                clinicId: req.clinicId,
                patientId,
                reason,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                priority: priority || 'NORMAL',
                status: 'CONFIRMED'
            }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'CREATE_APPOINTMENT',
            entity: 'APPOINTMENT',
            entityId: appointment.id,
            details: { reason, startTime },
            ipAddress: req.ip
        });

        res.json(appointment);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/appointments/:id/status', requireAuth, asyncHandler(async (req, res) => {
    try {
        const { status } = req.body;
        const appointment = await prisma.appointment.update({
            where: { id: req.params.id, clinicId: req.clinicId },
            data: { status }
        });
        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_APPOINTMENT_STATUS',
            entity: 'APPOINTMENT',
            entityId: req.params.id,
            details: { status },
            ipAddress: req.ip
        });
        res.json(appointment);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/appointments/:id', requireAuth, asyncHandler(async (req, res) => {
    try {
        await prisma.appointment.delete({
            where: { id: req.params.id, clinicId: req.clinicId }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'DELETE_APPOINTMENT',
            entity: 'APPOINTMENT',
            entityId: req.params.id,
            ipAddress: req.ip
        });

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/patients', requireAuth, asyncHandler(async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        const patient = await prisma.patient.create({
            data: { clinicId: req.clinicId, name, phone, email }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'CREATE_PATIENT',
            entity: 'PATIENT',
            entityId: patient.id,
            details: { name, phone },
            ipAddress: req.ip
        });

        res.json(patient);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/audit-logs', requireAuth, requireOwner, asyncHandler(async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { clinicId: req.clinicId },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(logs);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/messages/send', requireAuth, asyncHandler(async (req, res) => {
    const { patientId, message, type = 'SMS' } = req.body;

    if (!patientId || !message) {
        return res.status(400).json({ error: 'patientId and message are required' });
    }

    try {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId, clinicId: req.clinicId }
        });

        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        const clinic = req.clinic;
        if (clinic.messageCredits <= 0) {
            return res.status(403).json({ error: 'Insufficient message credits' });
        }

        // 1. Trigger Webhook (only if configured)
        let webhookResult = { success: true };
        if (clinic.webhookUrl) {
            webhookResult = await triggerWebhook(
                'message.direct_send',
                {
                    patientId,
                    patientName: patient.name,
                    phone: patient.phone,
                    message,
                    type
                },
                clinic.webhookUrl,
                clinic.webhookSecret,
                { awaitResponse: true }
            );
        }

        // 2. Update Credits & Log
        // Determine real delivery status based on webhook result
        let status = 'SIMULATED';
        if (clinic.webhookUrl) {
            status = webhookResult.success ? 'SENT' : 'FAILED';
        }
        
        await prisma.clinic.update({
            where: { id: req.clinicId },
            data: {
                messageCredits: { decrement: 1 },
                dailyUsedCount: { increment: 1 }
            }
        });

        const log = await prisma.messageLog.create({
            data: {
                clinicId: req.clinicId,
                type,
                status,
                cost: 1,
                error: webhookResult.success ? null : (webhookResult.message || null)
            }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'SEND_DIRECT_MESSAGE',
            entity: 'PATIENT',
            entityId: patientId,
            details: { message, status },
            ipAddress: req.ip
        });

        res.json({ success: true, logId: log.id, deliveryStatus: status });
    } catch (e) {
        console.error('[Messaging] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Sentry error handler
Sentry.setupExpressErrorHandler(app);

// Global error handler — catches anything forwarded via next(err) or asyncHandler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    console.error(`[ERROR] ${req.method} ${req.url} —`, err.message || err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(port, () => {
    console.log(`SaaS Backend running on port ${port}`);

    // System check — logs all critical config at startup
    console.log('\n=== System Check ===');
    console.log(`  DB:             ${process.env.DATABASE_URL                                          ? '✅ OK' : '❌ Missing DATABASE_URL'}`);
    console.log(`  JWT Secret:     ${process.env.JWT_SECRET                                            ? '✅ OK' : '⚠  Using insecure default'}`);
    console.log(`  Gemini AI:      ${process.env.GEMINI_API_KEY                                        ? '✅ OK' : '⚠  Missing — AI features use per-clinic keys only'}`);
    console.log(`  Twilio (env):   ${process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN   ? '✅ OK' : '⚠  Not set — SMS uses per-clinic keys'}`);
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
