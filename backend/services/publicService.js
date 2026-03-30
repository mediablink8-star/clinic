const prisma = require('./prisma');
const { triggerWebhook } = require('./webhookService');
const AppError = require('../errors/AppError');

async function getPublicClinic(clinicId) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, name: true, location: true, phone: true, email: true, workingHours: true, services: true, policies: true, avatarUrl: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    return {
        success: true,
        data: {
            ...clinic,
            workingHours: JSON.parse(clinic.workingHours || '{}'),
            services: JSON.parse(clinic.services || '[]'),
            policies: JSON.parse(clinic.policies || '{}')
        }
    };
}

/**
 * Returns available time slots for a specific date (e.g., '2026-04-15')
 * based on clinic's working hours and existing appointments.
 */
async function getAvailableSlots(clinicId, dateStr) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { workingHours: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const workingHours = JSON.parse(clinic.workingHours || '{}');
    const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Map full day names to shorthand used in settings if necessary
    const dayKey = dayName === 'saturday' ? 'saturday' : (dayName === 'sunday' ? 'sunday' : 'weekdays');
    const hours = workingHours[dayKey];

    if (!hours || hours === 'Closed') return [];

    // Parse "09:00 - 18:00"
    const [startH, endH] = hours.split(' - ').map(h => parseInt(h.split(':')[0]));
    
    // Get existing appointments for this day
    const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    
    const appointments = await prisma.appointment.findMany({
        where: {
            clinicId,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { notIn: ['CANCELLED', 'NOSHOW'] }
        },
        select: { startTime: true }
    });

    const bookedHours = appointments.map(a => a.startTime.getUTCHours());
    
    const slots = [];
    for (let h = startH; h < endH; h++) {
        const timeStr = `${h.toString().padStart(2, '0')}:00`;
        if (!bookedHours.includes(h)) {
            slots.push(timeStr);
        }
    }

    return slots;
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime }) {
    if (!clinicId || !name || !phone || !startTime) {
        throw new AppError('VALIDATION_ERROR', 'clinicId, name, phone and startTime are required', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, webhookUrl: true, webhookSecret: true, workingHours: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    // Double-booking check
    const existing = await prisma.appointment.findFirst({
        where: {
            clinicId,
            startTime: start,
            status: { notIn: ['CANCELLED', 'NOSHOW'] }
        }
    });
    if (existing) throw new AppError('CONFLICT', 'Time slot already booked', 409);

    // Atomic: upsert patient + create appointment in one transaction
    const { patient, appointment } = await prisma.$transaction(async (tx) => {
        let pt = await tx.patient.findFirst({ where: { clinicId, phone } });
        if (!pt) {
            pt = await tx.patient.create({ data: { clinicId, name, phone, email } });
        }
        const appt = await tx.appointment.create({
            data: { clinicId, patientId: pt.id, startTime: start, endTime: end, reason, status: 'PENDING' }
        });
        return { patient: pt, appointment: appt };
    });

    // Fire-and-forget webhook — failure must not block the booking response
    if (clinic.webhookUrl) {
        triggerWebhook(
            'appointment.created',
            {
                appointmentId: appointment.id,
                patientName: name,
                phone: patient.phone,
                date: start.toISOString().split('T')[0],
                time: start.toISOString().split('T')[1].slice(0, 5),
                reason
            },
            clinic.webhookUrl,
            clinic.webhookSecret
        ).catch(err => console.error('[publicService] Webhook trigger failed:', err.message));
    }

    return { success: true, data: { appointmentId: appointment.id } };
}

module.exports = { getPublicClinic, getAvailableSlots, bookAppointment };
