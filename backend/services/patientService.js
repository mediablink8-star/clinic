const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { normalizePhone } = require('../utils/phone');

async function listPatients(clinicId, { search, page = 1, limit = 50 } = {}) {
  const skip = (page - 1) * limit;
  const where = { clinicId };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await prisma.$transaction([
    prisma.patient.findMany({
      where,
      include: { appointments: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getPatient(clinicId, patientId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    include: { appointments: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);
  return { success: true, data: patient };
}

async function createPatient({ clinicId, name, phone, email }, actor) {
  if (!name || !phone) {
    throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);
  }

  const normalizedPhone = normalizePhone(phone);

  const patient = await prisma.patient.upsert({
    where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
    update: { name, email: email || undefined },
    create: { clinicId, name, phone: normalizedPhone, email },
  });

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'CREATE_PATIENT',
    entity: 'PATIENT',
    entityId: patient.id,
    details: { name, phone },
    ipAddress: actor?.ip,
  });

  return { success: true, data: patient };
}

async function updatePatient({ clinicId, patientId, name, phone, email }, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = normalizePhone(phone);
  if (email !== undefined) data.email = email || null;

  const updated = await prisma.patient.update({
    where: { id: patientId, clinicId },
    data,
  });

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'UPDATE_PATIENT',
    entity: 'PATIENT',
    entityId: patientId,
    details: data,
    ipAddress: actor?.ip,
  });

  return { success: true, data: updated };
}

async function deletePatient(clinicId, patientId, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  await prisma.$transaction([
    prisma.appointment.deleteMany({ where: { patientId, clinicId } }),
    prisma.patient.delete({ where: { id: patientId, clinicId } }),
  ]);

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'DELETE_PATIENT',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: actor?.ip,
  });

  return { success: true };
}

async function getPatientHistory(clinicId, patientId) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    include: {
      appointments: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { doctor: true, feedbacks: true },
      },
      missedCalls: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      recoveryCases: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { conversation: { include: { messages: { take: 10, orderBy: { createdAt: 'desc' } } } } },
      },
    },
  });

  if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);
  return { success: true, data: patient };
}

module.exports = {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientHistory,
};