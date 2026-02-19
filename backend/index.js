const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const { triggerWebhook } = require('./services/webhookService');
require('dotenv').config();

const { startNotificationWorker, startFollowUpWorker } = require('./services/notificationWorker');

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Start background workers
startNotificationWorker();
startFollowUpWorker();

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', language: 'greek-clinic-ready (SaaS Mode)' });
});

// --- ADMIN / PUBLIC ROUTES ---
app.get('/api/admin/clinics-list', async (req, res) => {
    try {
        const clinics = await prisma.clinic.findMany({
            select: { id: true, name: true, location: true }
        });
        res.json(clinics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const { verifyToken } = require('./services/authService');
const { validate, patientSchema, appointmentSchema, clinicUpdateSchema } = require('./services/validationService');

// --- SAAS MIDDLEWARE ---
// Extracts clinicId from Bearer Token
const requireClinic = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded || !decoded.clinicId) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const clinicId = decoded.clinicId;

    // Validate clinic exists
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) {
        return res.status(404).json({ error: 'Clinic not found' });
    }

    req.clinic = clinic; // Attach full clinic object for AI context
    req.clinicId = clinicId;
    next();
};

// --- ROUTES ---
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);

// Register AI Routes
const analysisRouter = require('./routes/analysis');
app.use('/api/analysis', requireClinic, analysisRouter);

const voiceRouter = require('./routes/voice');
app.use('/api/voice', voiceRouter);

const vapiRouter = require('./routes/vapi');
app.use('/api/vapi', vapiRouter);

const testRouter = require('./routes/test');
app.use('/api/test', testRouter);

// --- PATIENT ROUTES (Clinic Scoped) ---

// Get All Patients for this Clinic
app.get('/api/patients', requireClinic, async (req, res) => {
    try {
        const patients = await prisma.patient.findMany({
            where: { clinicId: req.clinicId },
            include: { appointments: true }
        });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Patient History (Confirm patient belongs to clinic)
app.get('/api/patients/:id', requireClinic, async (req, res) => {
    try {
        const patient = await prisma.patient.findFirst({
            where: {
                id: req.params.id,
                clinicId: req.clinicId
            },
            include: {
                appointments: { orderBy: { startTime: 'desc' } },
                // Feedbacks are linked via appointment, so effectively scoped
            }
        });
        if (!patient) return res.status(404).json({ error: 'Patient not found' });
        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Patient
app.post('/api/patients', requireClinic, validate(patientSchema), async (req, res) => {
    try {
        const { name, phone, email } = req.body;
        const patient = await prisma.patient.create({
            data: {
                clinicId: req.clinicId,
                name, phone, email
            }
        });
        res.json(patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const { classifyAppointment } = require('./services/aiTriage');

// Book Appointment
app.post('/api/appointments', requireClinic, validate(appointmentSchema), async (req, res) => {
    try {
        const { patientId, startTime, endTime, reason } = req.body;

        // Call AI Triage with Clinic Context
        const triage = await classifyAppointment(reason, req.clinic);

        const appointment = await prisma.appointment.create({
            data: {
                clinicId: req.clinicId,
                patientId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                reason,
                priority: triage.priority,
                aiClassification: triage.greekSummary
            }
        });

        // Schedule notification
        await prisma.notification.create({
            data: {
                clinicId: req.clinicId,
                appointmentId: appointment.id,
                type: 'REMINDER',
                scheduledFor: new Date(new Date(startTime).getTime() - 24 * 60 * 60 * 1000),
                message: `Γεια σας! Ραντεβού στο ${req.clinic.name}: ${new Date(startTime).toLocaleTimeString('el-GR')}.`
            }
        });

        // Trigger n8n Webhook for Calendar Sync
        triggerWebhook('appointment.created', {
            appointmentId: appointment.id,
            clinicId: req.clinicId,
            clinicName: req.clinic.name,
            patientId,
            date: new Date(startTime).toISOString().split('T')[0],
            time: new Date(startTime).toISOString().split('T')[1].substring(0, 5),
            reason,
            priority: triage.priority
        }, req.clinic.webhookUrl);

        res.json(appointment);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Appointments
app.get('/api/appointments', requireClinic, async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            where: { clinicId: req.clinicId },
            include: {
                patient: true,
                feedbacks: true
            },
            orderBy: { startTime: 'asc' }
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLINIC MANAGEMENT ---

// Get Current Clinic Info (from DB, not JSON)
app.get('/api/clinic', requireClinic, async (req, res) => {
    // Return the clinic object attached by middleware
    // Parse JSON fields
    const data = {
        ...req.clinic,
        workingHours: JSON.parse(req.clinic.workingHours),
        services: JSON.parse(req.clinic.services),
        policies: JSON.parse(req.clinic.policies)
    };
    res.json(data);
});

// Get Recent Notifications (Activity Feed)
app.get('/api/notifications', requireClinic, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { clinicId: req.clinicId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { appointment: { include: { patient: true } } }
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Clinic Info
app.post('/api/clinic', requireClinic, validate(clinicUpdateSchema), async (req, res) => {
    try {
        const { name, phone, email, webhookUrl, workingHours, services, policies } = req.body;
        await prisma.clinic.update({
            where: { id: req.clinicId },
            data: {
                name, phone, email, webhookUrl,
                workingHours: JSON.stringify(workingHours),
                services: JSON.stringify(services),
                policies: JSON.stringify(policies)
            }
        });
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Could not update clinic info' });
    }
});

app.listen(port, () => {
    console.log(`SaaS Backend running on port ${port}`);
});
