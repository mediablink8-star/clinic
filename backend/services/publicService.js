const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const AppError = require('../errors/AppError');
const { getAvailableSlots: getSlotsForDate } = require('./slotUtils');
const { normalizePhone } = require('../utils/phone');

function getDateTimeParts(date, timezone = 'Europe/Athens') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
    };
}

function parseDateTimeInTimezone(date, time, timezone = 'Europe/Athens') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date/time provided', 400);
    }

    const [year, month, day] = date.split('-').map((n) => parseInt(n, 10));
    const [hour, minute] = time.split(':').map((n) => parseInt(n, 10));

    // Build UTC candidate then adjust using target timezone offset
    const utcCandidate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
    const tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(utcCandidate).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    const asUtcInTimezone = Date.UTC(
        parseInt(tzParts.year, 10),
        parseInt(tzParts.month, 10) - 1,
        parseInt(tzParts.day, 10),
        parseInt(tzParts.hour, 10),
        parseInt(tzParts.minute, 10),
        parseInt(tzParts.second, 10)
    );
    const offsetMs = asUtcInTimezone - utcCandidate.getTime();

    return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - offsetMs);
}

async function getPublicClinic(clinicId) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, location: true, phone: true, email: true, workingHours: true, services: true, policies: true, avatarUrl: true },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    return {
        success: true,
        data: {
            ...clinic,
            workingHours: JSON.parse(clinic.workingHours || '{}'),
            services: JSON.parse(clinic.services || '[]'),
            policies: JSON.parse(clinic.policies || '{}'),
        },
    };
}

async function listPublicDoctors(clinicId) {
    const doctors = await prisma.doctor.findMany({
        where: { clinicId, isActive: true },
        select: { id: true, name: true, specialty: true, avatarUrl: true },
        orderBy: { name: 'asc' },
        take: 50
    });
    return { success: true, data: doctors };
}

async function getAvailableSlots(clinicId, dateStr, doctorId = null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) {
        throw new AppError('VALIDATION_ERROR', 'date must be YYYY-MM-DD', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { timezone: true },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const [year, month, day] = dateStr.split('-').map(n => parseInt(n, 10));
    const date = new Date(year, month - 1, day);
    let doctor = null;
    if (doctorId) {
        doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId, isActive: true } });
        if (!doctor) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    }
    return getSlotsForDate(clinicId, date, clinic.timezone || 'Europe/Athens', 60, doctor);
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId }) {
    if (!clinicId || !name || !phone) {
        throw new AppError('VALIDATION_ERROR', 'clinicId, name, and phone are required', 400);
    }
    
    // Check if we have either startTime OR both date and time (not empty strings)
    const hasStartTime = startTime && startTime.trim();
    const hasDateTime = date && date.trim() && time && time.trim();
    
    if (!hasStartTime && !hasDateTime) {
        throw new AppError('VALIDATION_ERROR', 'Either startTime or both date and time are required', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { 
            id: true, webhookUrl: true, webhookSecret: true, workingHours: true, aiConfig: true, 
            timezone: true, isActive: true,
            googleCalendarRefreshToken: true, googleCalendarEnabled: true, googleCalendarId: true,
            vonageApiKey: true, vonageApiSecret: true, vonageFromName: true
        },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'This clinic is not currently accepting bookings', 403);

    const timezone = clinic.timezone || 'Europe/Athens';
    let start;
    
    if (date && time) {
        start = parseDateTimeInTimezone(date, time, timezone);
    } else {
        start = new Date(startTime);
    }
    
    if (Number.isNaN(start.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date/time provided', 400);
    }
    if (start < new Date()) {
        throw new AppError('VALIDATION_ERROR', 'Cannot create appointments in the past', 400);
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const requested = getDateTimeParts(start, timezone);
    const availableSlots = await getAvailableSlots(clinicId, requested.date, doctorId);
    // Only reject if slots are configured AND the requested time isn't in them
    if (availableSlots.length > 0 && !availableSlots.includes(requested.time)) {
        throw new AppError('SLOT_UNAVAILABLE', 'Selected time slot is not available', 400);
    }

    const normalizedPhone = normalizePhone(phone);

    const { patient, appointment, missedCall, assignedDoctorId } = await prisma.$transaction(async (tx) => {
        let assignedDoctorId = doctorId;

        // Find an available doctor if none specified (Anyone Available)
        if (!assignedDoctorId) {
            const activeDoctors = await tx.doctor.findMany({
                where: { clinicId, isActive: true }
            });

            if (activeDoctors.length > 0) {
                for (const doc of activeDoctors) {
                    // Check if this doctor is within working hours for this specific time
                    const isWorking = require('./slotUtils').isWithinWorkingHours({
                        clinic,
                        doctor: doc,
                        start,
                        end,
                        timezone
                    });

                    if (!isWorking) continue;

                    // Check for conflicts for this specific doctor
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
                    throw new AppError('SLOT_UNAVAILABLE', 'No doctors are available at this time', 400);
                }
            }
        } else {
            // Specific doctor requested - check availability
            const doc = await tx.doctor.findFirst({ where: { id: assignedDoctorId, clinicId, isActive: true } });
            if (!doc) throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);

            const isWorking = require('./slotUtils').isWithinWorkingHours({
                clinic,
                doctor: doc,
                start,
                end,
                timezone
            });
            if (!isWorking) throw new AppError('SLOT_UNAVAILABLE', 'Doctor is not working at this time', 400);

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
                throw new AppError('CONFLICT', 'The selected doctor is already booked at this time', 409);
            }
        }

        let pt = await tx.patient.findFirst({ where: { clinicId, phone: normalizedPhone } });
        if (!pt) {
            pt = await tx.patient.create({ data: { clinicId, name, phone: normalizedPhone, email } });
        }
        const appt = await tx.appointment.create({
            data: { clinicId, patientId: pt.id, doctorId: assignedDoctorId || null, startTime: start, endTime: end, reason, status: 'PENDING' },
        });
        
        // If this booking is from a missed call recovery link, mark the missed call as RECOVERED
        let mc = null;
        if (missedCallId) {
            mc = await tx.missedCall.findFirst({
                where: { 
                    id: missedCallId, 
                    clinicId,
                    status: { in: ['DETECTED', 'RECOVERING'] } // Only recover if not already recovered
                }
            });
            
            if (mc) {
                // Get avgAppointmentValue from clinic config
                const clinicData = await tx.clinic.findUnique({
                    where: { id: clinicId },
                    select: { aiConfig: true }
                });
                
                let avgAppointmentValue = 80; // default
                try {
                    const aiConfig = typeof clinicData?.aiConfig === 'string' 
                        ? JSON.parse(clinicData.aiConfig) 
                        : (clinicData?.aiConfig || {});
                    avgAppointmentValue = parseFloat(aiConfig.avgAppointmentValue) || 80;
                } catch {}
                
                await tx.missedCall.update({
                    where: { id: missedCallId },
                    data: {
                        status: 'RECOVERED',
                        recoveredAt: new Date(),
                        patientId: pt.id,
                        appointmentId: appt.id,
                        estimatedRevenue: avgAppointmentValue
                    }
                });
                
                // Also update recovery case if exists
                await tx.recoveryCase.updateMany({
                    where: { missedCallId },
                    data: { state: 'RECOVERED' }
                });

            }
        }
        return { patient: pt, appointment: appt, missedCall: mc, assignedDoctorId };
    });

    if (clinic.webhookUrl) {
        triggerWebhook(
            'appointment.created',
            {
                appointmentId: appointment.id,
                patientName: name,
                phone: require('../utils/phone').formatForVonage(patient.phone),
                date: start.toISOString().split('T')[0],
                time: start.toISOString().split('T')[1].slice(0, 5),
                reason,
                doctorName: assignedDoctorId ? (await prisma.doctor.findUnique({ where: { id: assignedDoctorId } }))?.name || null : null,
                vonageApiKey: clinic.vonageApiKey ? require('./encryptionService').decrypt(clinic.vonageApiKey) : process.env.VONAGE_API_KEY,
                vonageApiSecret: clinic.vonageApiSecret ? require('./encryptionService').decrypt(clinic.vonageApiSecret) : process.env.VONAGE_API_SECRET,
                vonageFromName: clinic.vonageFromName || process.env.VONAGE_FROM_NAME || 'ClinicFlow'
            },
            clinic.webhookUrl,
            clinic.webhookSecret
        ).catch(() => {});
    }

    // Schedule 24h reminder
    const { scheduleAppointmentReminder } = require('./appointmentService');
    scheduleAppointmentReminder({ appointment, patient, clinic })
        .catch(err => console.warn('[Reminder] Failed to schedule from public booking:', err.message));

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
        .catch(err => console.warn('[GoogleCalendar] Push failed from public booking:', err.message));

    return { success: true, data: { appointmentId: appointment.id } };
}

module.exports = { getPublicClinic, listPublicDoctors, getAvailableSlots, bookAppointment, parseDateTimeInTimezone };
