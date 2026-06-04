const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const logger = require('../utils/logger');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const { getAvailableSlots: _getAvailableSlots, isWithinWorkingHours, getStartOfDay } = require('./slotUtils');
const { normalizePhone } = require('../utils/phone');
const { sendDirectMessage } = require('./messagingService');
const { fromZonedTime, formatInTimeZone } = require('date-fns-tz');
const { encrypt, decrypt } = require('./encryptionService');

const logPrefix = '[AppointmentService]';

const MIN_APPOINTMENT_MINUTES = 15;
const MAX_APPOINTMENT_MINUTES = 240;

const decryptAmka = (patient, user) => {
    if (!patient) return patient;
    if (patient.amka) {
        if (user && (user.role === 'OWNER' || user.role === 'AUTOMATION')) {
            try {
                if (patient.amka.includes(':')) {
                    patient.amka = decrypt(patient.amka);
                }
            } catch (err) {
                // Ignore or log decryption error
            }
        } else {
            patient.amka = null;
        }
    }
    return patient;
};

async function listPatients(clinicId, page = 1, limit = 50, deleted = false, user = null) {
    const skip = (page - 1) * limit;
    const where = { clinicId };
    if (deleted) {
        where.deletedAt = { not: null };
    } else {
        where.deletedAt = null;
    }
    const [data, total] = await Promise.all([
        prisma.patient.findMany({
            where,
            include: { appointments: { take: 5, orderBy: { createdAt: 'desc' } } },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.patient.count({ where })
    ]);
    const decryptedData = data.map(p => decryptAmka(p, user));
    return { success: true, data: decryptedData, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createPatient({ clinicId, name, phone, email, amka }, actor) {
    if (!name || !phone) throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);

    // Normalize phone — strip spaces/dashes, ensure consistent format
    const normalizedPhone = normalizePhone(phone);
    const encryptedAmka = amka ? encrypt(amka) : null;

    const updateData = { name, email: email || undefined };
    if (amka !== undefined) updateData.amka = encryptedAmka;

    const createData = { clinicId, name, phone: normalizedPhone, email };
    if (amka) createData.amka = encryptedAmka;

    // Upsert — if patient with same phone exists, update name/email/amka
    const patient = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
        update: updateData,
        create: createData,
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

    return { success: true, data: decryptAmka(patient, actor) };
}

async function listAppointments(clinicId, doctorId = null, page = 1, limit = 50, deleted = false, user = null) {
    const whereClause = { clinicId };
    if (doctorId) {
        whereClause.doctorId = doctorId;
    }
    if (deleted) {
        whereClause.deletedAt = { not: null };
    } else {
        whereClause.deletedAt = null;
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
        prisma.appointment.findMany({
            where: whereClause,
            include: { patient: true, feedbacks: true, doctor: true },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.appointment.count({ where: whereClause })
    ]);
    const decryptedData = data.map(apt => {
        if (apt.patient) {
            apt.patient = decryptAmka(apt.patient, user);
        }
        return apt;
    });
    return { success: true, data: decryptedData, total, page, limit, totalPages: Math.ceil(total / limit) };
}

async function createAppointment({ clinicId, patientId, reason, startTime, endTime, priority, doctorId, date, time, source }, actor) {
    if (!patientId) {
        throw new AppError('VALIDATION_ERROR', 'patientId is required', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, timezone: true, webhookSecret: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    const timezone = clinic.timezone || DEFAULT_TIMEZONE;

    let start, end;
    if (date && time) {
        // Construct local string WITHOUT 'T' or 'Z'
        const localDateTimeStr = `${date.trim()} ${time.trim()}:00`;
        start = fromZonedTime(localDateTimeStr, timezone);
        logger.info(`Staff Booking Parsed Time`, { localDateTimeStr, timezone, utc: start.toISOString() });
        end = new Date(start.getTime() + 60 * 60 * 1000); // Default 1h
    } else if (startTime && endTime) {
        start = new Date(startTime);
        end = new Date(endTime);
    } else {
        throw new AppError('VALIDATION_ERROR', 'Either (date + time) or (startTime + endTime) is required', 400);
    }
    let doctor = null;
    if (doctorId) {
        doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId, isActive: true } });
        if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    }
    if (!isWithinWorkingHours({ clinic, start, end, timezone, doctor })) {
        throw new AppError('VALIDATION_ERROR', 'Appointment must be inside clinic or doctor working hours', 400);
    }

    // Verify patient belongs to this clinic
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

    let appointment;
try {
         appointment = await prisma.$transaction(async (tx) => {
             let assignedDoctorId = doctorId;

             // Handle "Auto-assign" if no doctor provided in a multi-doctor clinic
             if (!assignedDoctorId) {
                 const activeDoctors = await tx.doctor.findMany({
                     where: { clinicId, isActive: true },
                     take: 100
                 });

                 if (activeDoctors.length > 0) {
                     for (const doc of activeDoctors) {
                         const isWorking = isWithinWorkingHours({
                             clinic,
                             doctor: doc,
                             start,
                             end,
                             timezone
                         });
                         if (!isWorking) continue;

                         const conflict = await tx.$queryRaw`
                             SELECT id FROM "Appointment"
                             WHERE "clinicId" = ${clinicId}
                             AND "doctorId" = ${doc.id}
                             AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                             AND "startTime" < ${end}
                             AND "endTime" > ${start}
                             FOR UPDATE
                             LIMIT 1
                         `;

                         if (!conflict || conflict.length === 0) {
                             assignedDoctorId = doc.id;
                             break;
                         }
                     }

                    if (!assignedDoctorId) {
                        logger.warn('AppointmentService No available doctors for slot', { startTime: start.toISOString() });
                        throw new AppError('CONFLICT', 'No doctors are available at this time', 409);
                    }
                 }
             } else {
                // Specific doctor check
                const conflict = await tx.$queryRaw`
                    SELECT id FROM "Appointment"
                    WHERE "clinicId" = ${clinicId}
                    AND "doctorId" = ${assignedDoctorId}
                    AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                    AND "startTime" < ${end}
                    AND "endTime" > ${start}
                    FOR UPDATE
                    LIMIT 1
                `;
                
                if (conflict && conflict.length > 0) {
                    throw new AppError('CONFLICT', 'The selected doctor is already booked', 409);
                }
            }

            const created = await tx.appointment.create({
                data: {
                    clinicId,
                    patientId,
                    doctorId: assignedDoctorId || null,
                    reason,
                    startTime: start,
                    endTime: end,
                    priority: priority || 'NORMAL',
                    status: 'CONFIRMED',
                    source: source || 'MANUAL'
                },
                include: { doctor: true, patient: true }
            });
            await logAction({
                clinicId,
                userId: actor.userId,
                action: 'CREATE_APPOINTMENT',
                entity: 'APPOINTMENT',
                entityId: created.id,
                details: { reason, startTime, doctorId: assignedDoctorId },
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
            const startDate = new Date(appointment.startTime);

            triggerWebhook(
                'appointment.created',
                {
                    appointmentId: appointment.id,
                    patientName: patient?.name || '',
                    phone: require('../utils/phone').digitsOnly(patient?.phone),
                    date: formatInTimeZone(startDate, timezone, 'yyyy-MM-dd'),
                    time: formatInTimeZone(startDate, timezone, 'HH:mm'),
                    reason: reason || '',
                    doctorName: appointment.doctor?.name || null,
                },
                null,
                clinic.webhookSecret,
                { clinic }
            ).catch(err => logger.warn('Webhook appointment.created failed', { error: err.message }));

            // Schedule 24h reminder if appointment is more than 25h away
            scheduleAppointmentReminder({ appointment, patient, clinic })
                .catch(err => {
                    logger.error('REMINDER_FATAL Failed to schedule reminder for appointment', { appointmentId: appointment.id, error: err.message });
                    // In a real production system, you might want to push this to a dead-letter queue
                    // or flag the appointment for manual review.
                });

            // Push to Google Calendar if connected
            const { createCalendarEvent } = require('./googleCalendarService');
            createCalendarEvent({ clinic, appointment, patient })
                .then(eventId => {
                    if (eventId) {
                        return prisma.appointment.update({
                            where: { id: appointment.id },
                            data: { googleCalendarEventId: eventId }
                        });
                    }
                })
                .catch(err => logger.warn('GoogleCalendar Push failed', { error: err.message }));

            // NEW: Send immediate confirmation SMS
            sendConfirmationSms({ appointment, patient, clinic })
                .catch(err => logger.warn('SMS Confirmation send failed', { error: err.message }));
        }
    }

    return { success: true, data: appointment };
}

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

    // Update Google Calendar event status if synced
    if (existing.googleCalendarEventId) {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        const patient = await prisma.patient.findUnique({ where: { id: existing.patientId } });
        const { updateCalendarEvent } = require('./googleCalendarService');
        updateCalendarEvent({
            clinic,
            googleCalendarEventId: existing.googleCalendarEventId,
            appointment: { ...existing, status },
            patient
        }).catch(err => logger.warn('GoogleCalendar Update failed', { error: err.message }));
    }

    // NEW: Send confirmation SMS if status changed to CONFIRMED
    if (status === 'CONFIRMED' && existing.status !== 'CONFIRMED') {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        const patient = await prisma.patient.findUnique({ where: { id: existing.patientId } });
        const doctor = existing.doctorId
            ? await prisma.doctor.findUnique({ where: { id: existing.doctorId } })
            : null;

        // 1. Send SMS (this also triggers message.direct_send webhook to n8n)
        sendConfirmationSms({ appointment: { ...existing, doctor }, patient, clinic })
            .catch(err => logger.warn('SMS Confirmation send failed', { error: err.message }));

        const startDate = new Date(existing.startTime);
        const timezone = clinic.timezone || DEFAULT_TIMEZONE;

        triggerWebhook(
            'appointment.confirmed',
            {
                appointmentId: existing.id,
                patientName: patient?.name || '',
                phone: patient?.phone || '',
                date: formatInTimeZone(startDate, timezone, 'yyyy-MM-dd'),
                time: formatInTimeZone(startDate, timezone, 'HH:mm'),
                status: 'CONFIRMED',
                doctorName: doctor?.name || null
            },
            null,
            clinic.webhookSecret,
            { clinic }
        ).catch(err => logger.warn('Webhook appointment.confirmed failed', { error: err.message }));
    }

    return { success: true, data: appointment };
}

async function deleteAppointment({ clinicId, appointmentId }, actor) {
    const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId } });
    if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found', 404);

    await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
            where: { id: appointmentId },
            data: { deletedAt: new Date() }
        });
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

async function restoreAppointment({ clinicId, appointmentId }, actor) {
    const existing = await prisma.appointment.findFirst({ where: { id: appointmentId, clinicId, deletedAt: { not: null } } });
    if (!existing) throw new AppError('NOT_FOUND', 'Appointment not found or not deleted', 404);

    await prisma.$transaction(async (tx) => {
        await tx.appointment.update({
            where: { id: appointmentId },
            data: { deletedAt: null }
        });
        await logAction({
            clinicId,
            userId: actor.userId,
            action: 'RESTORE_APPOINTMENT',
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
async function getAvailableSlots(clinicId, date, doctorId = null) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { timezone: true } });
    const timezone = clinic?.timezone || process.env.DEFAULT_TIMEZONE || DEFAULT_TIMEZONE;
    let doctor = null;
    if (doctorId) {
        doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId, isActive: true } });
        if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    }
    return _getAvailableSlots(clinicId, date, timezone, 60, doctor);
}

/**
 * Get today's appointments for a clinic.
 */
async function getTodayAppointments(clinicId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { timezone: true } });
    const timezone = clinic?.timezone || process.env.DEFAULT_TIMEZONE || DEFAULT_TIMEZONE;
    
    const todayStart = getStartOfDay(new Date(), timezone);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    
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
 */
async function scheduleAppointmentReminder({ appointment, patient, clinic }) {
    if (!patient?.phone) return;

    const appointmentStart = new Date(appointment.startTime);
    const reminderTime = new Date(appointmentStart.getTime() - 24 * 60 * 60 * 1000); // 24h before
    const now = new Date();

    // Only schedule if reminder time is at least 1 hour in the future
    if (reminderTime <= new Date(now.getTime() + 60 * 60 * 1000)) return;

    const timezone = clinic.timezone || DEFAULT_TIMEZONE;
    const clinicName = clinic.name || 'το ιατρείο';
    
    // Use clinic timezone for formatting
    const dateStr = formatInTimeZone(appointmentStart, timezone, 'EEEE d MMMM', { locale: require('date-fns/locale/el') });
    const timeStr = formatInTimeZone(appointmentStart, timezone, 'HH:mm');

    const message = `Υπενθύμιση ραντεβού 📅\n${clinicName}: ${dateStr} στις ${timeStr}${appointment.doctor?.name ? ` με τον/την ${appointment.doctor.name}` : ''}.\nΣας περιμένουμε! 😊`;

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

/**
 * Send an immediate SMS confirmation to the patient.
 */
async function sendConfirmationSms({ appointment, patient, clinic }) {
    if (!patient?.phone) return;

    const appointmentStart = new Date(appointment.startTime);
    const timezone = clinic.timezone || DEFAULT_TIMEZONE;
    const clinicName = clinic.name || 'το ιατρείο';

    // Use clinic timezone for formatting
    const dateStr = formatInTimeZone(appointmentStart, timezone, 'EEEE d MMMM', { locale: require('date-fns/locale/el') });
    const timeStr = formatInTimeZone(appointmentStart, timezone, 'HH:mm');

    const message = `Επιβεβαίωση Ραντεβού 📅\n${clinicName}: Το ραντεβού σας κατοχυρώθηκε${appointment.doctor?.name ? ` με τον/την ${appointment.doctor.name}` : ''} για ${dateStr} στις ${timeStr}. Σας περιμένουμε! 😊`;

    return sendDirectMessage(
        { clinicId: clinic.id, patientId: patient.id, message, type: 'SMS', clinic },
        { userId: 'SYSTEM', ip: '127.0.0.1' }
    );
}

module.exports = { listPatients, createPatient, listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment, restoreAppointment, getAvailableSlots, getTodayAppointments, scheduleAppointmentReminder, sendConfirmationSms };

