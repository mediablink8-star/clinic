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

async function getAvailableSlots(clinicId, dateStr) {
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
    return getSlotsForDate(clinicId, date, clinic.timezone || 'Europe/Athens');
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time }) {
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
        select: { id: true, webhookUrl: true, webhookSecret: true, workingHours: true, aiConfig: true, timezone: true, isActive: true },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'This clinic is not currently accepting bookings', 403);

    const timezone = clinic.timezone || 'Europe/Athens';
    let start;
    
    // If date and time are provided separately, construct the datetime in clinic's timezone
    if (date && time) {
        const [year, month, day] = date.split('-').map(Number);
        const [hour, minute] = time.split(':').map(Number);
        
        // Create a date string in the clinic's timezone
        // Use Intl.DateTimeFormat to properly handle timezone conversion
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
        
        // Parse this as a local date and adjust for timezone
        // We need to find what UTC time corresponds to this local time in the clinic's timezone
        const localDate = new Date(year, month - 1, day, hour, minute, 0);
        
        // Get the timezone offset for this specific date (handles DST)
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        // Create a reference date to calculate offset
        const refDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
        const parts = formatter.formatToParts(refDate);
        const tzYear = parseInt(parts.find(p => p.type === 'year').value);
        const tzMonth = parseInt(parts.find(p => p.type === 'month').value);
        const tzDay = parseInt(parts.find(p => p.type === 'day').value);
        const tzHour = parseInt(parts.find(p => p.type === 'hour').value);
        const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);
        
        // Calculate the offset
        const tzDate = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, 0));
        const offset = refDate.getTime() - tzDate.getTime();
        
        // Apply offset to get correct UTC time
        start = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offset);
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
    const availableSlots = await getAvailableSlots(clinicId, requested.date);
    // Only reject if slots are configured AND the requested time isn't in them
    if (availableSlots.length > 0 && !availableSlots.includes(requested.time)) {
        throw new AppError('SLOT_UNAVAILABLE', 'Selected time slot is not available', 400);
    }

    const normalizedPhone = normalizePhone(phone);

    const { patient, appointment } = await prisma.$transaction(async (tx) => {
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

        let pt = await tx.patient.findFirst({ where: { clinicId, phone: normalizedPhone } });
        if (!pt) {
            pt = await tx.patient.create({ data: { clinicId, name, phone: normalizedPhone, email } });
        }
        const appt = await tx.appointment.create({
            data: { clinicId, patientId: pt.id, startTime: start, endTime: end, reason, status: 'PENDING' },
        });
        console.log('[PUBLIC BOOKING] Created appointment:', {
            id: appt.id,
            clinicId: appt.clinicId,
            patientId: appt.patientId,
            patientName: pt.name,
            startTime: appt.startTime,
            endTime: appt.endTime,
            status: appt.status,
            reason: appt.reason
        });
        return { patient: pt, appointment: appt };
    });

    if (clinic.webhookUrl) {
        triggerWebhook(
            'appointment.created',
            {
                appointmentId: appointment.id,
                patientName: name,
                phone: patient.phone,
                date: start.toISOString().split('T')[0],
                time: start.toISOString().split('T')[1].slice(0, 5),
                reason,
            },
            clinic.webhookUrl,
            clinic.webhookSecret
        ).catch(err => console.error('[publicService] Webhook trigger failed:', err.message));
    }

    return { success: true, data: { appointmentId: appointment.id } };
}

module.exports = { getPublicClinic, getAvailableSlots, bookAppointment };
