const prisma = require('./prisma');
const { logAction } = require('./auditService');
const AppError = require('../errors/AppError');

async function listPatients(clinicId) {
    const data = await prisma.patient.findMany({
        where: { clinicId },
        include: { appointments: true }
    });
    return { success: true, data };
}

async function createPatient({ clinicId, name, phone, email }, actor) {
    if (!name || !phone) throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);

    // Upsert — if patient with same phone exists, update name/email
    const patient = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId, phone } },
        update: { name, email: email || undefined },
        create: { clinicId, name, phone, email },
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

    // Verify patient belongs to this clinic
    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

    const appointment = await prisma.$transaction(async (tx) => {
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

module.exports = { listPatients, createPatient, listAppointments, createAppointment, updateAppointmentStatus, deleteAppointment };
