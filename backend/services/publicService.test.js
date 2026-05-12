process.env.DB_ENCRYPTION_KEY = 'test_key_for_jest_tests_only';

jest.mock('./prisma', () => ({
    clinic: {
        findUnique: jest.fn(),
    },
    doctor: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    appointment: {
        findMany: jest.fn(),
    },
    $transaction: jest.fn(),
}));

jest.mock('./webhookService', () => ({
    triggerWebhook: jest.fn(),
}));

const prisma = require('./prisma');
const { bookAppointment, getAvailableSlots, parseDateTimeInTimezone } = require('./publicService');

const clinic = {
    id: 'clinic_1',
    isActive: true,
    webhookUrl: null,
    webhookSecret: 'secret',
    workingHours: JSON.stringify({ weekdays: '09:00 - 18:00', saturday: 'Closed', sunday: 'Closed' }),
    aiConfig: '{}',
    timezone: 'Europe/Athens',
};

describe('publicService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prisma.clinic.findUnique.mockResolvedValue(clinic);
        prisma.doctor.findMany.mockResolvedValue([]);
        prisma.doctor.findUnique.mockResolvedValue(null);
        prisma.appointment.findMany.mockResolvedValue([]);
    });

    test('rejects malformed slot dates', async () => {
        await expect(getAvailableSlots('clinic_1', '05/02/2026')).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            status: 400,
        });
    });

    test('rejects public booking when requested time is not in available slots', async () => {
        await expect(bookAppointment({
            clinicId: 'clinic_1',
            name: 'Test Patient',
            phone: '6912345678',
            email: '',
            reason: 'Checkup',
            startTime: '2026-05-20T06:30:00.000Z',
        })).rejects.toMatchObject({
            code: 'SLOT_UNAVAILABLE',
            status: 400,
        });
    });

    test('normalizes phone before creating public booking', async () => {
        const tx = {
            $queryRaw: jest.fn().mockResolvedValue([]),
            appointment: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockResolvedValue({ id: 'appt_1' }),
            },
            doctor: {
                findMany: jest.fn().mockResolvedValue([]),
                findFirst: jest.fn().mockResolvedValue(null),
            },
            patient: {
                findFirst: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'patient_1', ...data })),
            },
            missedCall: {
                findFirst: jest.fn(),
                update: jest.fn(),
            },
            recoveryCase: {
                updateMany: jest.fn(),
            },
            clinic: {
                findUnique: jest.fn(),
            },
        };
        prisma.$transaction.mockImplementation(async (callback) => callback(tx));

        const result = await bookAppointment({
            clinicId: 'clinic_1',
            name: 'Test Patient',
            phone: '691 234 5678',
            email: '',
            reason: 'Checkup',
            startTime: '2026-05-20T06:00:00.000Z',
        });

        expect(result.data.appointmentId).toBe('appt_1');
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.patient.findFirst).toHaveBeenCalledWith({
            where: { clinicId: 'clinic_1', phone: '+306912345678' },
        });
        expect(tx.patient.create).toHaveBeenCalledWith({
            data: {
                clinicId: 'clinic_1',
                name: 'Test Patient',
                phone: '+306912345678',
                email: '',
            },
        });
    });

    test('parses local clinic date/time consistently to UTC', () => {
        const parsed = parseDateTimeInTimezone('2026-07-15', '10:00', 'Europe/Athens');
        // July in Athens is UTC+3, so 10:00 local should be 07:00 UTC
        expect(parsed.toISOString()).toBe('2026-07-15T07:00:00.000Z');
    });

    test('parses winter clinic date/time with UTC+2 offset', () => {
        const parsed = parseDateTimeInTimezone('2026-01-15', '10:00', 'Europe/Athens');
        // January in Athens is UTC+2, so 10:00 local should be 08:00 UTC
        expect(parsed.toISOString()).toBe('2026-01-15T08:00:00.000Z');
    });
});
