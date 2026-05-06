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

async function bookAppointment({ clinicId, name, phone, email, reason, startTime }) {
    if (!clinicId || !name || !phone || !startTime) {
        throw new AppError('VALIDATION_ERROR', 'clinicId, name, phone and startTime are required', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, webhookUrl: true, webhookSecret: true, workingHours: true, aiConfig: true, timezone: true, isActive: true },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);
    if (!clinic.isActive) throw new AppError('CLINIC_INACTIVE', 'This clinic is not currently accepting bookings', 403);

    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'startTime must be a valid ISO date', 400);
    }
    if (start < new Date()) {
        throw new AppError('VALIDATION_ERROR', 'Cannot create appointments in the past', 400);
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const timezone = clinic.timezone || 'Europe/Athens';
    const requested = getDateTimeParts(start, timezone);
    const availableSlots = await getAvailableSlots(clinicId, requested.date);
    // Only reject if slots are configured AND the requested time isn't in them
    if (availableSlots.length > 0 && !availableSlots.includes(requested.time)) {
        throw new AppError('SLOT_UNAVAILABLE', 'Selected time slot is not available', 400);
    }

    const normalizedPhone = normalizePhone(phone);

    const { patient, appointment } = await prisma.$transaction(async (tx) => {
        const existing = await tx.appointment.findFirst({
            where: {
                clinicId,
                status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                AND: [
                    { startTime: { lt: end } },
                    { endTime: { gt: start } },
                ],
            },
        });
        if (existing) {
            throw new AppError('CONFLICT', 'Time slot already booked', 409);
        }

        let pt = await tx.patient.findFirst({ where: { clinicId, phone: normalizedPhone } });
        if (!pt) {
            pt = await tx.patient.create({ data: { clinicId, name, phone: normalizedPhone, email } });
        }
        const appt = await tx.appointment.create({
            data: { clinicId, patientId: pt.id, startTime: start, endTime: end, reason, status: 'PENDING' },
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
