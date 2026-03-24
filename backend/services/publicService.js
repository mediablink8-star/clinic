const { PrismaClient } = require('@prisma/client');
const { triggerWebhook } = require('./webhookService');
const AppError = require('../errors/AppError');

const prisma = new PrismaClient();

async function getPublicClinic(clinicId) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { name: true, location: true, phone: true, email: true, workingHours: true, services: true, policies: true, avatarUrl: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    return {
        success: true,
        data: {
            ...clinic,
            workingHours: JSON.parse(clinic.workingHours),
            services: JSON.parse(clinic.services),
            policies: JSON.parse(clinic.policies)
        }
    };
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime }) {
    if (!clinicId || !name || !phone || !startTime) {
        throw new AppError('VALIDATION_ERROR', 'clinicId, name, phone and startTime are required', 400);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { id: true, webhookUrl: true, webhookSecret: true }
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const start = new Date(startTime);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

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

module.exports = { getPublicClinic, bookAppointment };
