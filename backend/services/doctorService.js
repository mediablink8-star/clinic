const prisma = require('./prisma');
const AppError = require('../errors/AppError');
const { getAvailableSlots } = require('./slotUtils');

async function listDoctors(clinicId) {
    const doctors = await prisma.doctor.findMany({
        where: { clinicId, isActive: true },
        orderBy: { name: 'asc' },
        take: 50
    });
    return { success: true, data: doctors };
}

async function createDoctor({ clinicId, name, specialty, phone, email, workingHours }) {
    if (!name) {
        throw new AppError('VALIDATION_ERROR', 'Name is required', 400);
    }
    
    // Parse workingHours if it's a string
    let parsedWorkingHours = workingHours;
    if (typeof workingHours === 'string') {
        try {
            parsedWorkingHours = JSON.parse(workingHours);
        } catch (e) {
            throw new AppError('VALIDATION_ERROR', 'workingHours must be valid JSON', 400);
        }
    }

    const doctor = await prisma.doctor.create({
        data: {
            clinicId,
            name,
            specialty,
            phone,
            email,
            workingHours: parsedWorkingHours,
        }
    });

    return { success: true, data: doctor };
}

async function updateDoctor({ clinicId, doctorId, name, specialty, phone, email, workingHours, avatarUrl }) {
    const existing = await prisma.doctor.findFirst({
        where: { id: doctorId, clinicId }
    });

    if (!existing) {
        throw new AppError('NOT_FOUND', 'Doctor not found', 404);
    }

    let parsedWorkingHours = workingHours;
    if (typeof workingHours === 'string') {
        try {
            parsedWorkingHours = JSON.parse(workingHours);
        } catch (e) {
            throw new AppError('VALIDATION_ERROR', 'workingHours must be valid JSON', 400);
        }
    } else if (workingHours === undefined) {
        parsedWorkingHours = existing.workingHours;
    }

    const updated = await prisma.doctor.update({
        where: { id: doctorId },
        data: {
            name: name !== undefined ? name : existing.name,
            specialty: specialty !== undefined ? specialty : existing.specialty,
            phone: phone !== undefined ? phone : existing.phone,
            email: email !== undefined ? email : existing.email,
            workingHours: parsedWorkingHours,
            avatarUrl: avatarUrl !== undefined ? avatarUrl : existing.avatarUrl
        }
    });

    return { success: true, data: updated };
}

async function deactivateDoctor({ clinicId, doctorId }) {
    const existing = await prisma.doctor.findFirst({
        where: { id: doctorId, clinicId }
    });

    if (!existing) {
        throw new AppError('NOT_FOUND', 'Doctor not found', 404);
    }

    await prisma.doctor.update({
        where: { id: doctorId },
        data: { isActive: false }
    });

    return { success: true };
}

async function getDoctorAvailability({ clinicId, doctorId, date }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        throw new AppError('VALIDATION_ERROR', 'date must be YYYY-MM-DD', 400);
    }
    
    const existing = await prisma.doctor.findFirst({
        where: { id: doctorId, clinicId, isActive: true }
    });

    if (!existing) {
        throw new AppError('NOT_FOUND', 'Doctor not found or inactive', 404);
    }

    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { timezone: true },
    });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
        throw new AppError('VALIDATION_ERROR', 'Invalid date provided', 400);
    }

    const timezone = clinic.timezone || 'Europe/Athens';
    const slots = await getAvailableSlots(clinicId, targetDate, timezone, 60, existing);

    return { success: true, date, slots };
}

async function getDoctorAnalytics(clinicId) {
    const doctors = await prisma.doctor.findMany({
        where: { clinicId, isActive: true },
        select: { id: true, name: true, specialty: true, avatarUrl: true }
    });

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const analytics = await Promise.all(doctors.map(async (doc) => {
        const appointmentsCount = await prisma.appointment.count({
            where: {
                clinicId,
                doctorId: doc.id,
                startTime: { gte: startOfMonth }
            }
        });

        const recoveredStats = await prisma.missedCall.aggregate({
            where: {
                clinicId,
                status: 'RECOVERED',
                appointment: {
                    doctorId: doc.id
                },
                recoveredAt: { gte: startOfMonth }
            },
            _count: { id: true },
            _sum: { estimatedRevenue: true }
        });

        return {
            id: doc.id,
            name: doc.name,
            specialty: doc.specialty,
            avatarUrl: doc.avatarUrl,
            appointmentsThisMonth: appointmentsCount,
            recoveredThisMonth: recoveredStats._count.id || 0,
            revenueThisMonth: recoveredStats._sum.estimatedRevenue || 0
        };
    }));

    return { success: true, data: analytics };
}

module.exports = {
    listDoctors,
    createDoctor,
    updateDoctor,
    deactivateDoctor,
    getDoctorAvailability,
    getDoctorAnalytics
};
