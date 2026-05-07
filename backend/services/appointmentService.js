const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { getAvailableSlots: _getAvailableSlots, isWithinWorkingHours } = require('./slotUtils');
const { normalizePhone } = require('../utils/phone');

const MIN_APPOINTMENT_MINUTES = 15;
const MAX_APPOINTMENT_MINUTES = 240;

async function listPatients(clinicId) {
    const data = await prisma.patient.findMany({
        where: { clinicId },
        include: { appointments: true },
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    return { success: true, data };
}

async function createPatient({ clinicId, name, phone, email }, actor) {
    if (!name || !phone) throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);

    // Normalize phone — strip spaces/dashes, ensure consistent format
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
        include: { patient: true, feedbacks: true },
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    console.log(`[LIST APPOINTMENTS] Clinic ${clinicId}: Found ${data.length} appointments`);
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

    if (start >= end)
        throw new AppError('VALIDATION_ERROR', 'startTime must be before endTime', 400);

    const durationMinutes = (end - start) / 60000;
    if (durationMinutes < MIN_APPOINTMENT_MINUTES || durationMinutes > MAX_APPOINTMENT_MINUTES || durationMinutes % 15 !== 0) {
        throw new AppError('VALIDATION_ERROR', 'Appointment duration must be 15-240 minutes in 15-minute increments', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
            id: true,
            name: true,
            phone: true,
            location: true,
            services: true,
            policies: true,
            timezone: true,
            workingHours: true,
            aiConfig: true,
            webhookUrl: true,
            webhookSecret: true,
            webhookAppointment: true
        }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!isWithinWorkingHours({ clinic, start, end, timezone: clinic.timezone || 'Europe/Athens' })) {
        throw new AppError('VALIDATION_ERROR', 'Appointment must be inside clinic working hours', 400);
    }

    // Verify patient belongs to this clinic
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

    let appointment;
    try {
        appointment = await prisma.$transaction(async (tx) => {
            // Use FOR UPDATE to lock conflicting appointments during check
            // This prevents race conditions when multiple requests try to book the same slot
            const conflict = await tx.$queryRaw`
                SELECT id FROM "Appointment"
                WHERE "clinicId" = ${clinicId}
                AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                AND "startTime" < ${end}
                AND "endTime" > ${start}
                FOR UPDATE
                LIMIT 1
            `;
            
            if (conflict && conflict.length > 0) {
                throw new AppError('CONFLICT', 'Time slot already booked', 409);
            }

            const created = await tx.appointment.create({
                data: {
                    clinicId,
                    patientId,
                    reason,
                    startTime: start,
                    endTime: end,
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
    } catch (err) {
        // Handle Prisma unique constraint violation (race condition)
        if (err.code === 'P2002') {
            throw new AppError('CONFLICT', 'Time slot already booked', 409);
        }
        throw err;
    }

    // Fire appointment.created webhook → n8n workflow 1
    if (appointment) {
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

            // Schedule 24h reminder if appointment is more than 25h away
            scheduleAppointmentReminder({ appointment, patient, clinic })
                .catch(err => console.warn('[Reminder] Failed to schedule:', err.message));
        }
    }

    return { success: true, data: appointment };

async function updateAppointmentStatus({ clinicId, appointmentId, status }, actor) {
    const VALID_STATUSES = ['CONFIRMED', 'PENDING', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
    if (!status) throw new AppError('VALIDATION_ERROR', 'status is required', 400);
    if (!VALID_STATUSES.includes(status)) {
        throw new AppError('VALIDATION_ERROR', `status must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }

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
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { timezone: true } });
    const timezone = clinic?.timezone || 'Europe/Athens';
    return _getAvailableSlots(clinicId, date, timezone);
}

/**
 * Get today's appointments for a clinic.
 */
async function getTodayAppointments(clinicId) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const data = await prisma.appointment.findMany({
        where: { clinicId, startTime: { gte: todayStart, lte: todayEnd } },
        include: { patient: true },
        orderBy: { startTime: 'asc' },
        take: 50
    });
    return { success: true, data };
}

/**
 * Schedule a 24-hour SMS reminder for an appointment.
 * Only schedules if the appointment is more than 25 hours away.
 */
async function scheduleAppointmentReminder({ appointment, patient, clinic }) {
    if (!patient?.phone) return;

    const appointmentStart = new Date(appointment.startTime);
    const reminderTime = new Date(appointmentStart.getTime() - 24 * 60 * 60 * 1000); // 24h before
    const now = new Date();

    // Only schedule if reminder time is at least 1 hour in the future
    if (reminderTime <= new Date(now.getTime() + 60 * 60 * 1000)) return;

    const clinicName = clinic.name || 'το ιατρείο';
    const dateStr = appointmentStart.toLocaleDateString('el-GR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const timeStr = appointmentStart.toLocaleTimeString('el-GR', {
        hour: '2-digit', minute: '2-digit'
    });

    const message = `Υπενθύμιση ραντεβού 📅\n${clinicName}: ${dateStr} στις ${timeStr}.\nΣας περιμένουμε! 😊`;

    // Avoid duplicate reminders for the same appointment
    const existing = await prisma.notification.findFirst({
        where: {
            appointmentId: appointment.id,
            type: 'REMINDER',
            status: { in: ['SCHEDULED', 'ENQUEUED', 'SENT'] }
        }
    });
    if (existing) return;

    await prisma.notification.create({
        data: {
            clinicId: appointment.clinicId,
            appointmentId: appointment.id,
            type: 'REMINDER',
            message,
            scheduledFor: reminderTime,
            status: 'SCHEDULED',
        }
    });
}

module.exports = { listPatients, createPatient, listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment, getAvailableSlots, getTodayAppointments, scheduleAppointmentReminder };

