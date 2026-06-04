const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const logger = require('../utils/logger');

/**
 * Public-facing clinic service — no authentication required.
 * Used by public booking flow and clinic directory.
 */

async function getPublicClinic(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId, isActive: true },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      location: true,
      timezone: true,
      services: true,
      workingHours: true,
      onboardingCompleted: true,
      createdAt: true,
      _count: {
        select: {
          doctors: { where: { isActive: true } },
          patients: true,
          appointments: { where: { status: 'CONFIRMED' } },
        },
      },
    },
  });

  if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found or inactive', 404);
  return { success: true, data: clinic };
}

async function listPublicDoctors(clinicId) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId, isActive: true },
    select: { id: true },
  });
  if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found or inactive', 404);

  const doctors = await prisma.doctor.findMany({
    where: { clinicId, isActive: true },
    select: {
      id: true,
      name: true,
      specialty: true,
      phone: true,
      email: true,
      avatarUrl: true,
      workingHours: true,
    },
    orderBy: { name: 'asc' },
    take: 50,
  });

  return { success: true, data: doctors };
}

async function getAvailableSlots(clinicId, date, doctorId = null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid date format. Use YYYY-MM-DD.', 400);
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { timezone: true }
  });
  const timezone = clinic?.timezone || DEFAULT_TIMEZONE;

  const { getAvailableSlots: _getSlots } = require('./slotUtils');
  
  let doctor = null;
  if (doctorId) {
    doctor = await prisma.doctor.findFirst({
      where: { id: doctorId, clinicId, isActive: true }
    });
  }

  const slots = await _getSlots(clinicId, date, timezone, 60, doctor);
  return { success: true, data: slots };
}

const { formatInTimeZone, fromZonedTime, toZonedTime } = require('date-fns-tz');

function parseDateTimeInTimezone(date, time, timezone) {
  const localDateTimeStr = `${date.trim()} ${time.trim()}:00`;
  return fromZonedTime(localDateTimeStr, timezone);
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId }) {
    // Validate clinic exists and is active before booking
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, isActive: true, timezone: true, webhookSecret: true, aiConfig: true, workingHours: true }, // aiConfig needed internally for avgAppointmentValue — NOT returned to client
    });
    if (!clinic || !clinic.isActive) {
        throw new AppError('NOT_FOUND', 'Clinic not found or inactive', 404);
    }

    const timezone = clinic.timezone || DEFAULT_TIMEZONE;

    // Resolve start/end times from date+time or startTime
    let startDateTime;
    if (startTime) {
        startDateTime = new Date(startTime);
    } else if (date && time) {
        startDateTime = parseDateTimeInTimezone(date, time, timezone);
        logger.info('Public Booking Parsed Time', { localDateTimeStr: `${date.trim()} ${time.trim()}:00`, timezone, utc: startDateTime.toISOString() });
    } else {
        throw new AppError('VALIDATION_ERROR', 'Either startTime or date+time is required', 400);
    }

    const endTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    // Fetch doctor if doctorId is provided; otherwise prepare active doctors for auto-assignment.
    // This keeps public booking behavior consistent with slot discovery, which exposes a slot
    // when at least one active doctor can take it.
    let doctor = null;
    let autoAssignableDoctors = [];
    if (doctorId) {
        doctor = await prisma.doctor.findFirst({
            where: { id: doctorId, clinicId, isActive: true }
        });
        if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    } else {
        autoAssignableDoctors = await prisma.doctor.findMany({
            where: { clinicId, isActive: true },
            orderBy: { name: 'asc' }
        });
    }

    // Enforce clinic/doctor working hours. For auto-assignment, at least one active doctor
    // must be working; for doctorless clinics, fall back to clinic-level working hours.
    const { isWithinWorkingHours } = require('./slotUtils');
    if (doctorId) {
        if (!isWithinWorkingHours({ clinic, start: startDateTime, end: endTime, timezone, doctor })) {
            throw new AppError('VALIDATION_ERROR', 'The requested appointment time is outside working hours.', 400);
        }
    } else if (autoAssignableDoctors.length > 0) {
        autoAssignableDoctors = autoAssignableDoctors.filter((candidate) =>
            isWithinWorkingHours({ clinic, start: startDateTime, end: endTime, timezone, doctor: candidate })
        );
        if (autoAssignableDoctors.length === 0) {
            throw new AppError('VALIDATION_ERROR', 'The requested appointment time is outside working hours.', 400);
        }
    } else if (!isWithinWorkingHours({ clinic, start: startDateTime, end: endTime, timezone, doctor: null })) {
        throw new AppError('VALIDATION_ERROR', 'The requested appointment time is outside working hours.', 400);
    }

    // Create appointment with double-booking prevention
    const appointment = await prisma.$transaction(async (tx) => {
        let assignedDoctorId = doctorId || null;
        // Build or find patient INSIDE transaction
        let patient;
        if (phone) {
            const { normalizePhone } = require('../utils/phone');
            const normalizedPhone = normalizePhone(phone);
            patient = await tx.patient.upsert({
                where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
                update: { name: name || undefined, email: email || undefined },
                create: {
                    clinicId,
                    name: name || 'Ανώνυμος',
                    phone: normalizedPhone,
                    email: email || null,
                },
            });
        } else {
            throw new AppError('VALIDATION_ERROR', 'Phone number is required', 400);
        }

        if (doctorId) {
            // Specific doctor — check only that doctor's schedule
            const conflict = await tx.$queryRaw`
                SELECT id FROM "Appointment"
                WHERE "clinicId" = ${clinicId}
                AND "doctorId" = ${doctorId}
                AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                AND "startTime" < ${endTime}
                AND "endTime" > ${startDateTime}
                FOR UPDATE
                LIMIT 1
            `;

            if (conflict && conflict.length > 0) {
                throw new AppError('CONFLICT', 'This time slot has already been booked. Please choose a different time.', 409);
            }
        } else if (autoAssignableDoctors.length > 0) {
            // No specific doctor — assign the booking to the first doctor who is both working
            // and conflict-free. This avoids rejecting valid public slots in multi-doctor clinics.
            for (const candidate of autoAssignableDoctors) {
                const conflict = await tx.$queryRaw`
                    SELECT id FROM "Appointment"
                    WHERE "clinicId" = ${clinicId}
                    AND "doctorId" = ${candidate.id}
                    AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                    AND "startTime" < ${endTime}
                    AND "endTime" > ${startDateTime}
                    FOR UPDATE
                    LIMIT 1
                `;

                if (!conflict || conflict.length === 0) {
                    assignedDoctorId = candidate.id;
                    break;
                }
            }

            if (!assignedDoctorId) {
                throw new AppError('CONFLICT', 'All doctors are busy at this time. Please choose a different time.', 409);
            }
        } else {
            // Clinics without configured doctors use a clinic-level calendar resource.
            const conflicts = await tx.$queryRaw`
                SELECT id FROM "Appointment"
                WHERE "clinicId" = ${clinicId}
                AND "doctorId" IS NULL
                AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
                AND "startTime" < ${endTime}
                AND "endTime" > ${startDateTime}
                FOR UPDATE
                LIMIT 1
            `;

            if (conflicts && conflicts.length > 0) {
                throw new AppError('CONFLICT', 'This time slot has already been booked. Please choose a different time.', 409);
            }
        }

        const appt = await tx.appointment.create({
            data: {
                clinicId,
                patientId: patient.id,
                reason: reason || null,
                startTime: startDateTime,
                endTime,
                status: 'CONFIRMED',
                priority: 'NORMAL',
                doctorId: assignedDoctorId,
                source: missedCallId ? 'SMS_BOOKING' : 'PUBLIC_LINK',
            },
            include: { patient: true, doctor: true },
        });

        if (missedCallId) {
            const mc = await tx.missedCall.findFirst({
                where: { id: missedCallId, clinicId }
            });
            if (!mc) throw new AppError('NOT_FOUND', 'Missed call not found', 404);
            await tx.missedCall.update({
                where: { id: mc.id },
                data: {
                    status: 'RECOVERED',
                    recoveredAt: new Date(),
                    appointmentId: appt.id,
                },
            });
        }

        return appt;
    });

    // Record feed event outside transaction
    if (appointment) {
        const feedType = missedCallId ? 'APPOINTMENT_BOOKED_VIA_SMS' : 'APPOINTMENT_BOOKED_VIA_LINK';
        const doctorValue = appointment.doctor?.avgAppointmentValue;
        const aiConfig = (() => { try { return typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {}); } catch { return {}; } })();
        const defaultRevenue = parseFloat(aiConfig.avgAppointmentValue) || 80;
        const estimatedRevenue = doctorValue || defaultRevenue;
        prisma.feedEvent?.create({
            data: {
                clinicId,
                type: feedType,
                title: feedType === 'APPOINTMENT_BOOKED_VIA_LINK' ? 'Ραντεβού από δημόσιο σύνδεσμο' : 'Ραντεβού από SMS ανάκτησης',
                patientName: appointment.patient?.name || name,
                phone: appointment.patient?.phone || phone,
                appointmentId: appointment.id,
                metadata: { estimatedRevenue },
            }
        })?.catch(err => logger.warn('FeedEvent Failed to create', { error: err.message }));
    }

    // Fire side-effects outside transaction
    if (appointment) {
        const { triggerWebhook } = require('./webhookService');
        const { scheduleAppointmentReminder, sendConfirmationSms } = require('./appointmentService');

        triggerWebhook(
            'appointment.created',
            {
                appointmentId: appointment.id,
                patientName: appointment.patient.name,
                phone: require('../utils/phone').digitsOnly(appointment.patient.phone),
                date: formatInTimeZone(appointment.startTime, timezone, 'yyyy-MM-dd'),
                time: formatInTimeZone(appointment.startTime, timezone, 'HH:mm'),
                reason: reason || '',
                doctorName: appointment.doctor?.name || null,
            },
            null,
            clinic.webhookSecret,
            { clinic }
        ).catch(err => logger.warn('Webhook appointment.created failed', { error: err.message }));

        scheduleAppointmentReminder({ appointment, patient: appointment.patient, clinic })
            .catch(err => logger.error('REMINDER Fail', { error: err.message }));

        sendConfirmationSms({ appointment, patient: appointment.patient, clinic })
            .catch(err => logger.warn('SMS Fail', { error: err.message }));

        // Push to Google Calendar if connected
        const { createCalendarEvent } = require('./googleCalendarService');
        createCalendarEvent({ clinic, appointment, patient: appointment.patient })
            .then(eventId => {
                if (eventId) {
                    return prisma.appointment.update({
                        where: { id: appointment.id },
                        data: { googleCalendarEventId: eventId }
                    });
                }
            })
            .catch(err => logger.warn('GoogleCalendar Push failed', { error: err.message }));
    }

    if (missedCallId) {
        try {
            const { markRecoveryCaseRecovered } = require('./recoveryTrackingService');
            await markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt: new Date() });
        } catch (err) {
            logger.error('PUBLIC BOOKING Error marking recovery case recovered', { err });
        }
    }

    return {
        success: true,
        data: {
            appointmentId: appointment.id,
            patientName: appointment.patient.name,
            startTime: appointment.startTime,
            doctorName: appointment.doctor?.name || null,
        },
    };
}

module.exports = {
  getPublicClinic,
  listPublicDoctors,
  getAvailableSlots,
  bookAppointment,
  parseDateTimeInTimezone,
};
