const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');
const { getAvailableSlots: _getAvailableSlots, isWithinWorkingHours } = require('./slotUtils');
const { normalizePhone } = require('../utils/phone');
const { sendDirectMessage } = require('./messagingService');

const logPrefix = '[AppointmentService]';

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

async function listAppointments(clinicId, doctorId = null) {
    const whereClause = { clinicId };
    if (doctorId) {
        whereClause.doctorId = doctorId;
    }
    const data = await prisma.appointment.findMany({
        where: whereClause,
        include: { patient: true, feedbacks: true, doctor: true },
        orderBy: { createdAt: 'desc' },
        take: 200
    });
    return { success: true, data };
}

async function createAppointment({ clinicId, patientId, reason, startTime, endTime, priority, doctorId }, actor) {
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
            webhookAppointment: true,
            vonageApiKey: true,
            vonageApiSecret: true,
            vonageFromName: true,
            googleCalendarRefreshToken: true,
            googleCalendarEnabled: true,
            googleCalendarId: true,
        }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    const timezone = clinic.timezone || process.env.DEFAULT_TIMEZONE || 'Europe/Athens';
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
                     where: { clinicId, isActive: true }
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
                         console.warn(`${logPrefix} No available doctors for slot ${start.toISOString()}`);
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
                    status: 'CONFIRMED'
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
            const { decrypt } = require('./encryptionService');
            const vonageApiKey = clinic.vonageApiKey ? decrypt(clinic.vonageApiKey) : process.env.VONAGE_API_KEY;
            const vonageApiSecret = clinic.vonageApiSecret ? decrypt(clinic.vonageApiSecret) : process.env.VONAGE_API_SECRET;
            const vonageFromName = clinic.vonageFromName || process.env.VONAGE_FROM_NAME || 'ClinicFlow';

            triggerWebhook(
                'appointment.created',
                {
                    appointmentId: appointment.id,
                    patientName: patient?.name || '',
                    phone: require('../utils/phone').digitsOnly(patient?.phone),
                    date: startDate.toLocaleDateString('el-GR'),
                    time: startDate.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
                    reason: reason || '',
                    doctorName: appointment.doctor?.name || null,
                    vonageApiKey,
                    vonageApiSecret,
                    vonageFromName,
                },
                null,
                clinic.webhookSecret,
                { clinic }
            ).catch(err => console.warn('[Webhook] appointment.created failed:', err.message));

            // Schedule 24h reminder if appointment is more than 25h away
            scheduleAppointmentReminder({ appointment, patient, clinic })
                .catch(err => {
                    console.error('[REMINDER_FATAL] Failed to schedule reminder for appointment:', appointment.id, err.message);
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
                .catch(err => console.warn('[GoogleCalendar] Push failed:', err.message));

            // NEW: Send immediate confirmation SMS
            sendConfirmationSms({ appointment, patient, clinic })
                .catch(err => console.warn('[SMS] Confirmation send failed:', err.message));
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
        }).catch(err => console.warn('[GoogleCalendar] Update failed:', err.message));
    }

    // NEW: Send confirmation SMS if status changed to CONFIRMED
    if (status === 'CONFIRMED') {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        const patient = await prisma.patient.findUnique({ where: { id: existing.patientId } });
        
        // 1. Send SMS (this also triggers message.direct_send webhook to n8n)
        sendConfirmationSms({ appointment, patient, clinic })
            .catch(err => console.warn('[SMS] Confirmation send failed:', err.message));

        // 2. Clear explicit event webhook to n8n (for custom workflows like medical forms)
        const startDate = new Date(appointment.startTime);
        triggerWebhook(
            'appointment.confirmed',
            {
                appointmentId: appointment.id,
                patientName: patient?.name || '',
                phone: patient?.phone || '',
                date: startDate.toLocaleDateString('el-GR'),
                time: startDate.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }),
                status: 'CONFIRMED',
                doctorName: appointment.doctor?.name || null
            },
            null,
            clinic.webhookSecret,
            { clinic }
        ).catch(err => console.warn('[Webhook] appointment.confirmed failed:', err.message));
    }

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

    // Remove from Google Calendar if synced
    if (existing.googleCalendarEventId) {
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
        const { deleteCalendarEvent } = require('./googleCalendarService');
        deleteCalendarEvent({ clinic, googleCalendarEventId: existing.googleCalendarEventId })
            .catch(err => console.warn('[GoogleCalendar] Delete failed:', err.message));
    }

    return { success: true };
}


/**
 * Get available 1-hour appointment slots for a given date.
 * Returns array of time strings like ["09:00", "10:00", "11:00"]
 */
async function getAvailableSlots(clinicId, date, doctorId = null) {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { timezone: true } });
    const timezone = clinic?.timezone || process.env.DEFAULT_TIMEZONE || 'Europe/Athens';
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
    const timezone = clinic?.timezone || process.env.DEFAULT_TIMEZONE || 'Europe/Athens';
    
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
    const clinicName = clinic.name || 'το ιατρείο';
    const dateStr = appointmentStart.toLocaleDateString('el-GR', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
    const timeStr = appointmentStart.toLocaleTimeString('el-GR', {
        hour: '2-digit', minute: '2-digit'
    });

    const message = `Επιβεβαίωση Ραντεβού 📅\n${clinicName}: Το ραντεβού σας κατοχυρώθηκε${appointment.doctor?.name ? ` με τον/την ${appointment.doctor.name}` : ''} για ${dateStr} στις ${timeStr}. Σας περιμένουμε! 😊`;

    return sendDirectMessage(
        { clinicId: clinic.id, patientId: patient.id, message, type: 'SMS', clinic },
        { userId: 'SYSTEM', ip: '127.0.0.1' }
    );
}

module.exports = { listPatients, createPatient, listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment, getAvailableSlots, getTodayAppointments, scheduleAppointmentReminder, sendConfirmationSms };

