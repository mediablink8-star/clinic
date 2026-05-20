const { Prisma } = require('@prisma/client');
const prisma = require('./prisma');
const AppError = require('../errors/AppError');

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
      aiConfig: true,
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

  const { getAvailableSlots: _getSlots } = require('./slotUtils');
  const slots = await _getSlots(clinicId, date, 'Europe/Athens', 60, doctorId);
  return { success: true, data: slots };
}

async function bookAppointment({ clinicId, name, phone, email, reason, startTime, date, time, missedCallId, doctorId }) {
  // Resolve start/end times from date+time or startTime
  let startDateTime;
  if (startTime) {
    startDateTime = new Date(startTime);
  } else if (date && time) {
    startDateTime = new Date(`${date}T${time}`);
  } else {
    throw new AppError('VALIDATION_ERROR', 'Either startTime or date+time is required', 400);
  }

  // Validate clinic exists and is active before booking
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true, name: true, isActive: true },
  });
  if (!clinic || !clinic.isActive) {
    throw new AppError('NOT_FOUND', 'Clinic not found or inactive', 404);
  }

  const endTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

  // Create appointment with double-booking prevention
  const appointment = await prisma.$transaction(async (tx) => {
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
    } else {
      // No specific doctor — check ALL doctors to prevent double-booking
      const conflicts = await tx.$queryRaw`
        SELECT id FROM "Appointment"
        WHERE "clinicId" = ${clinicId}
        AND "doctorId" IS NOT NULL
        AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
        AND "startTime" < ${endTime}
        AND "endTime" > ${startDateTime}
        FOR UPDATE
        LIMIT 1
      `;

      if (conflicts && conflicts.length > 0) {
        throw new AppError('CONFLICT', 'All doctors are busy at this time. Please choose a different time.', 409);
      }
    }

    return tx.appointment.create({
      data: {
        clinicId,
        patientId: patient.id,
        reason: reason || null,
        startTime: startDateTime,
        endTime,
        status: 'CONFIRMED',
        priority: 'NORMAL',
        doctorId: doctorId || null,
      },
      include: { patient: true, doctor: true },
    });
  });

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

function parseDateTimeInTimezone(dateStr, timeStr, timezone) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const tzParts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const tzName = tzParts.find((p) => p.type === 'timeZoneName')?.value || '';
  const match = tzName.match(/GMT([-+])(\d{1,2}):?(\d{2})?/);

  if (match) {
    const sign = match[1];
    const h = match[2].padStart(2, '0');
    const m = (match[3] || '00').padStart(2, '0');
    return new Date(`${dateStr}T${timeStr}:00${sign}${h}:${m}`);
  }

  return new Date(`${dateStr}T${timeStr}:00Z`);
}

module.exports = {
  getPublicClinic,
  listPublicDoctors,
  getAvailableSlots,
  bookAppointment,
  parseDateTimeInTimezone,
};
