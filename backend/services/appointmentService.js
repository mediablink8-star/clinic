const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { isWithinWorkingHours } = require('./slotUtils');

const MIN_APPOINTMENT_MINUTES = 15;
const MAX_APPOINTMENT_MINUTES = 240;

async function listPatients(clinicId) {
    const data = await prisma.patient.findMany({
        where: { clinicId },
        include: { appointments: true }
    });
    return { success: true, data };
}

function normalizePhone(phone) {
    if (!phone) return null;
    return phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+').replace(/^0/, '+30');
}

async function createPatient({ clinicId, name, phone, email }, actor) {
    if (!name || !phone) throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);

    const normalizedPhone = normalizePhone(phone);

    // Upsert — if patient with same phone exists, update name/email
    const patient = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
        update: { name, email: email || undefined },
        create: { clinicId, name, phone: normalizedPhone, email },
    });

    await logAction({
        clinicId,
        userId: actor?.userId,
        action: 'CREATE_PATIENT',
        entity: 'PATIENT',
        entityId: patient.id,
        details: { name, phone },
        ipAddress: actor?.ip
    });

    return { success: true, data: patient };
}

async function listAppointments(clinicId) {
    const data = await prisma.appointment.findMany({
        where: { clinicId },
        include: { patient: true },
        orderBy: { startTime: 'asc' }
    });
    return { success: true, data };
}

async function createAppointment({ clinicId, patientId, reason, startTime, endTime, priority }, actor) {
    if (!patientId || !startTime || !endTime) {
        throw new AppError('VALIDATION_ERROR', 'patientId, startTime and endTime are required', 400);
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'startTime and endTime must be valid ISO dates', 400);
    }
    if (start >= end) {
        throw new AppError('VALIDATION_ERROR', 'startTime must be before endTime', 400);
    }
    if (start < new Date()) {
        throw new AppError('VALIDATION_ERROR', 'Cannot create appointments in the past', 400);
    }

    const durationMinutes = (end - start) / 60000;
    if (durationMinutes < MIN_APPOINTMENT_MINUTES || durationMinutes > MAX_APPOINTMENT_MINUTES || durationMinutes % 15 !== 0) {
        throw new AppError('VALIDATION_ERROR', 'Appointment duration must be 15-240 minutes in 15-minute increments', 400);
    }

    // Verify clinic and check working hours
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!isWithinWorkingHours({ clinic, start, end, timezone: clinic.timezone || 'Europe/Athens' })) {
        throw new AppError('VALIDATION_ERROR', 'Appointment must be inside clinic working hours', 400);
    }

    // Verify patient belongs to this clinic
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

    const appointment = await prisma.$transaction(async (tx) => {
        // Check for conflicts
        const conflict = await tx.appointment.findFirst({
            where: {
                clinicId,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                AND: [
                    { startTime: { lt: end } },
                    { endTime: { gt: start } }
                ]
            }
        });
        if (conflict) throw new AppError('CONFLICT', 'Time slot already booked', 409);
        const created = await tx.appointment.create({
            data: {
                clinicId,
                patientId,
                reason,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                priority: priority || 'NORMAL',
                status: 'CONFIRMED'
            }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'CREATE_APPOINTMENT',
            entity: 'APPOINTMENT',
            entityId: created.id,
            details: { reason, startTime },
            ipAddress: actor.ip
        });
        return created;
    });

    // Fire appointment.created webhook → n8n workflow 1
    if (appointment) {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        if (clinic) {
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            const startDate = new Date(startTime);
            triggerWebhook(
                'appointment.created',
                {
                    appointmentId: appointment.id,
                    patientName: patient?.name || '',
                    phone: patient?.phone || '',
                    date: startDate.toLocaleDateString('el-GR'),
                    time: startDate.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
                    reason: reason || '',
                },
                null,
                clinic.webhookSecret,
                { clinic }
            ).catch(err => console.warn('[Webhook] appointment.created failed:', err.message));
        }
    }

    return { success: true, data: appointment };
}

async function updateAppointmentStatus({ clinicId, appointmentId, status }, actor) {
    if (!status) throw new AppError('VALIDATION_ERROR', 'status is required', 400);

    const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId } });
    if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

    const appointment = await prisma.$transaction(async (tx) => {
        const updated = await tx.appointment.update({
            where: { id: appointmentId },
            data: { status }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'UPDATE_APPOINTMENT_STATUS',
            entity: 'APPOINTMENT',
            entityId: appointmentId,
            details: { status },
            ipAddress: actor.ip
        });
        return updated;
    });

    return { success: true, data: appointment };
}

async function deleteAppointment({ clinicId, appointmentId }, actor) {
    const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId } });
    if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

    await prisma.$transaction(async (tx) => {
        await tx.appointment.delete({ where: { id: appointmentId } });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'DELETE_APPOINTMENT',
            entity: 'APPOINTMENT',
            entityId: appointmentId,
            ipAddress: actor.ip
        });
    });

    return { success: true };
}


/**
 * Get available 1-hour appointment slots for a given date.
 * Returns array of time strings like ["09:00", "10:00", "11:00"]
 */
async function getAvailableSlots(clinicId, date) {
    let aiCfg = {};
    let clinicTimezone = 'Europe/Athens';
    try {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { aiConfig: true, workingHours: true } });
        aiCfg = typeof clinic?.aiConfig === 'string' ? JSON.parse(clinic.aiConfig || '{}') : (clinic?.aiConfig || {});
    } catch (e) {
        console.warn('[getAvailableSlots] Failed to parse aiConfig:', e.message);
    }

    // Determine working hours for this day
    const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
    const dayName = dayNames[date.getDay()];
    const wh = aiCfg.workingHours || {};
    const rangeStr = wh[dayName];

    let openHour = 9, closeHour = 17;
    if (rangeStr && rangeStr.includes('-')) {
        const [openStr, closeStr] = rangeStr.split('-');
        openHour = parseInt(openStr.split(':')[0]) || 9;
        closeHour = parseInt(closeStr.split(':')[0]) || 17;
    }

    // Get existing appointments for this date in clinic's timezone
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findMany({
        where: {
            clinicId,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { notIn: ['CANCELLED'] }
        },
        select: { startTime: true, endTime: true }
    });

    // Convert to clinic timezone hours
    const bookedHours = new Set(existing.map(a => {
        const dateObj = new Date(a.startTime);
        return dateObj.toLocaleString('en-US', { timeZone: clinicTimezone, hour: '2-digit', hour12: false });
    }));

    // Build available slots
    const slots = [];
    for (let h = openHour; h < closeHour; h++) {
        const hourStr = String(h).padStart(2, '0');
        if (!bookedHours.has(hourStr)) {
            slots.push(`${hourStr}:00`);
        }
    }

    return slots;
}

module.exports = { listPatients, createPatient, listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment, getAvailableSlots };

