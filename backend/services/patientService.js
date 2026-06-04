const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { normalizePhone } = require('../utils/phone');
const { encrypt, decrypt } = require('./encryptionService');

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

async function listPatients(clinicId, { search, page = 1, limit = 50, deleted = false } = {}, user = null) {
  const skip = (page - 1) * limit;
  const where = { clinicId };
  if (deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

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

  const decryptedData = data.map(p => decryptAmka(p, user));

  return {
    success: true,
    data: decryptedData,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function getPatient(clinicId, patientId, user = null) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
    include: { appointments: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);
  return { success: true, data: decryptAmka(patient, user) };
}

async function createPatient({ clinicId, name, phone, email, amka }, actor) {
  if (!name || !phone) {
    throw new AppError('VALIDATION_ERROR', 'name and phone are required', 400);
  }

  const normalizedPhone = normalizePhone(phone);
  const encryptedAmka = amka ? encrypt(amka) : null;

  const updateData = { name, email: email || undefined };
  if (amka !== undefined) updateData.amka = encryptedAmka;

  const createData = { clinicId, name, phone: normalizedPhone, email };
  if (amka) createData.amka = encryptedAmka;

  const patient = await prisma.patient.upsert({
    where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
    update: updateData,
    create: createData,
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

  return { success: true, data: decryptAmka(patient, actor) };
}

async function updatePatient({ clinicId, patientId, name, phone, email, amka }, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  const data = {};
  if (name !== undefined) data.name = name;
  if (phone !== undefined) data.phone = normalizePhone(phone);
  if (email !== undefined) data.email = email || null;
  if (amka !== undefined) data.amka = amka ? encrypt(amka) : null;

  const updated = await prisma.patient.update({
    where: { id: patientId },
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

  return { success: true, data: decryptAmka(updated, actor) };
}

async function deletePatient(clinicId, patientId, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: { deletedAt: new Date() },
    });
    await tx.appointment.updateMany({
      where: { patientId, clinicId },
      data: { deletedAt: new Date() },
    });
  });

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

async function restorePatient(clinicId, patientId, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, deletedAt: { not: null } },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found or not deleted', 404);

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: { deletedAt: null },
    });
    await tx.appointment.updateMany({
      where: { patientId, clinicId },
      data: { deletedAt: null },
    });
  });

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'RESTORE_PATIENT',
    entity: 'PATIENT',
    entityId: patientId,
    ipAddress: actor?.ip,
  });

  return { success: true };
}

async function getPatientHistory(clinicId, patientId, user = null) {
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
  return { success: true, data: decryptAmka(patient, user) };
}

module.exports = {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  restorePatient,
  getPatientHistory,
};