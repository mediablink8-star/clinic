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

async function findPatientByAmka(clinicId, amka, excludePatientId = null) {
  if (!amka) return null;
  const all = await prisma.patient.findMany({
    where: { clinicId, amka: { not: null } },
    select: { id: true, amka: true }
  });
  for (const p of all) {
    if (p.id === excludePatientId) continue;
    try {
      if (p.amka && p.amka.includes(':')) {
        const decrypted = decrypt(p.amka);
        if (decrypted === amka) return p;
      } else if (p.amka === amka) {
        return p;
      }
    } catch {}
  }
  return null;
}

async function listPatients(clinicId, { search, amka, page = 1, limit = 50, deleted = false } = {}, user = null) {
  const skip = (page - 1) * limit;
  const where = { clinicId };
  if (deleted) {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }
  where.anonymizedAt = null;

  if (amka) {
    const match = await findPatientByAmka(clinicId, amka);
    where.id = match ? match.id : '__no_match__';
  } else if (search) {
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

  if (amka) {
    const existing = await findPatientByAmka(clinicId, amka);
    if (existing) {
      throw new AppError('CONFLICT', 'Υπάρχει ήδη ασθενής με αυτό το Α.Μ.Κ.Α. στο ιατρείο.', 409);
    }
  }

  const updateData = { name, email: email || undefined };
  if (amka !== undefined) updateData.amka = encryptedAmka;

  const createData = { clinicId, name, phone: normalizedPhone, email };
  if (amka) createData.amka = encryptedAmka;

  let patient;
  try {
    patient = await prisma.patient.upsert({
      where: { clinicId_phone: { clinicId, phone: normalizedPhone } },
      update: updateData,
      create: createData,
    });
  } catch (err) {
    if (err.code === 'P2002' && err.meta?.target?.includes('amka')) {
      throw new AppError('CONFLICT', 'Υπάρχει ήδη ασθενής με αυτό το Α.Μ.Κ.Α. στο ιατρείο.', 409);
    }
    throw err;
  }

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'CREATE_PATIENT',
    entity: 'PATIENT',
    entityId: patient.id,
    details: { name, phone, amkaLast4: amka ? amka.slice(-4) : null },
    ipAddress: actor?.ip,
  });

  return { success: true, data: decryptAmka(patient, actor) };
}

async function updatePatient({ clinicId, patientId, name, phone, email, amka }, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  if (amka) {
    const dupe = await findPatientByAmka(clinicId, amka, patientId);
    if (dupe) {
      throw new AppError('CONFLICT', 'Υπάρχει ήδη ασθενής με αυτό το Α.Μ.Κ.Α. στο ιατρείο.', 409);
    }
  }

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

  if (existing.anonymizedAt) {
    throw new AppError('CONFLICT', 'Patient has already been anonymized (GDPR right-to-be-forgotten).', 409);
  }

  const originalPhone = existing.phone || '';
  const phoneLast4 = originalPhone.slice(-4);
  const patientIdLast4 = patientId.slice(-4);

  await prisma.$transaction(async (tx) => {
    await tx.patient.update({
      where: { id: patientId },
      data: {
        name: `ANONYMIZED-${patientIdLast4}`,
        phone: `+30****${phoneLast4}`,
        email: null,
        amka: null,
        deletedAt: new Date(),
        anonymizedAt: new Date(),
        anonymizedBy: actor?.userId || 'system',
      },
    });
    await tx.appointment.updateMany({
      where: { patientId, clinicId },
      data: { deletedAt: new Date(), notes: null, reason: null, aiClassification: null },
    });
  });

  const { logAction } = require('./auditService');
  await logAction({
    clinicId,
    userId: actor?.userId,
    action: 'GDPR_ANONYMIZE_PATIENT',
    entity: 'PATIENT',
    entityId: patientId,
    details: {
      reason: 'GDPR right-to-be-forgotten',
      phoneLast4,
      patientIdLast4,
      hadEmail: !!existing.email,
      hadAmka: !!existing.amka,
    },
    ipAddress: actor?.ip,
  });

  return { success: true };
}

async function restorePatient(clinicId, patientId, actor) {
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, clinicId, anonymizedAt: null, deletedAt: { not: null } },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Patient not found, not deleted, or already anonymized', 404);

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

async function getPatientExport(clinicId, patientId, { decryptFor = null, userId = null, ip = null } = {}) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, clinicId }
  });
  if (!patient) throw new AppError('NOT_FOUND', 'Patient not found', 404);

  const [appointments, recoveryCases, missedCalls, messages] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId, clinicId },
      orderBy: { createdAt: 'desc' },
      include: { doctor: { select: { id: true, name: true, specialty: true } }, feedbacks: true }
    }),
    prisma.recoveryCase.findMany({
      where: { patientId, clinicId },
      orderBy: { createdAt: 'desc' },
      include: { conversation: { include: { messages: { orderBy: { createdAt: 'asc' } } } } }
    }),
    prisma.missedCall.findMany({
      where: { patientId, clinicId },
      orderBy: { createdAt: 'desc' }
    }),
    (async () => {
      const recoveryCaseIds = (await prisma.recoveryCase.findMany({
        where: { patientId, clinicId },
        select: { id: true }
      })).map(r => r.id);
      if (recoveryCaseIds.length === 0) return [];
      return prisma.message.findMany({
        where: { clinicId, conversation: { recoveryCaseId: { in: recoveryCaseIds } } },
        orderBy: { createdAt: 'asc' }
      });
    })()
  ]);

  const patientForExport = { ...patient };
  if (patientForExport.amka && decryptFor && (decryptFor.role === 'OWNER' || decryptFor.role === 'ADMIN' || decryptFor.role === 'AUTOMATION')) {
    try {
      if (patientForExport.amka.includes(':')) {
        patientForExport.amka = decrypt(patientForExport.amka);
      }
    } catch {}
  } else if (patientForExport.amka) {
    patientForExport.amka = null;
  }

  return {
    exportedAt: new Date().toISOString(),
    clinicId,
    patientId,
    requestedBy: { userId, ip },
    patient: patientForExport,
    appointments,
    recoveryCases,
    missedCalls,
    messages,
    summary: {
      appointmentCount: appointments.length,
      recoveryCaseCount: recoveryCases.length,
      missedCallCount: missedCalls.length,
      messageCount: messages.length
    }
  };
}

module.exports = {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  restorePatient,
  getPatientHistory,
  getPatientExport,
};