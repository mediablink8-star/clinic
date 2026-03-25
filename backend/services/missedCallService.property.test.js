// Feature: workflow-driven-recovery, Property 8: mark-recovered sets status and recoveredAt, and is idempotent
// Validates: Requirements 6.1, 6.2, 11.3

const fc = require('fast-check');
const { PrismaClient } = require('@prisma/client');
const { markRecovered } = require('./missedCallService');

const prisma = new PrismaClient();

// Helper: create a minimal clinic for testing
async function createTestClinic(suffix) {
    return prisma.clinic.create({
        data: {
            name: `Test Clinic ${suffix}`,
            location: 'Test Location',
            phone: '+30000000000',
            email: `test${suffix}@clinic.com`,
            workingHours: '{}',
            services: '[]',
            policies: '{}',
        }
    });
}

// Helper: create a MissedCall in a given status
async function createTestMissedCall(clinicId, status = 'RECOVERING') {
    return prisma.missedCall.create({
        data: {
            clinicId,
            fromNumber: '+30123456789',
            status,
            smsStatus: 'pending',
        }
    });
}

// Cleanup helper
async function cleanup(clinicId) {
    await prisma.missedCall.deleteMany({ where: { clinicId } });
    await prisma.clinic.delete({ where: { id: clinicId } });
}

describe('Property 8: mark-recovered sets status and recoveredAt, and is idempotent', () => {
    // Test with various non-recovered statuses
    const nonRecoveredStatuses = ['DETECTED', 'RECOVERING', 'LOST'];

    test('sets status=RECOVERED and recoveredAt on first call', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...nonRecoveredStatuses),
                fc.nat({ max: 99999 }),
                async (initialStatus, suffix) => {
                    const clinic = await createTestClinic(`prop8a_${suffix}`);
                    const mc = await createTestMissedCall(clinic.id, initialStatus);

                    try {
                        const before = new Date();
                        const result = await markRecovered({ clinicId: clinic.id, missedCallId: mc.id });
                        const after = new Date();

                        // Response shape
                        expect(result.success).toBe(true);
                        expect(result.data.missedCallId).toBe(mc.id);
                        expect(result.data.status).toBe('RECOVERED');

                        // DB state
                        const updated = await prisma.missedCall.findUnique({ where: { id: mc.id } });
                        expect(updated.status).toBe('RECOVERED');
                        expect(updated.recoveredAt).not.toBeNull();
                        expect(updated.recoveredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
                        expect(updated.recoveredAt.getTime()).toBeLessThanOrEqual(after.getTime());
                    } finally {
                        await cleanup(clinic.id);
                    }
                }
            ),
            { numRuns: 10 }
        );
    }, 30000);

    test('is idempotent: second call returns success without overwriting recoveredAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(...nonRecoveredStatuses),
                fc.nat({ max: 99999 }),
                async (initialStatus, suffix) => {
                    const clinic = await createTestClinic(`prop8b_${suffix}`);
                    const mc = await createTestMissedCall(clinic.id, initialStatus);

                    try {
                        // First call
                        const result1 = await markRecovered({ clinicId: clinic.id, missedCallId: mc.id });
                        expect(result1.success).toBe(true);

                        const afterFirst = await prisma.missedCall.findUnique({ where: { id: mc.id } });
                        const originalRecoveredAt = afterFirst.recoveredAt;

                        // Small delay to ensure time difference would be detectable
                        await new Promise(r => setTimeout(r, 5));

                        // Second call (idempotent)
                        const result2 = await markRecovered({ clinicId: clinic.id, missedCallId: mc.id });
                        expect(result2.success).toBe(true);
                        expect(result2.data.status).toBe('RECOVERED');
                        expect(result2.data.missedCallId).toBe(mc.id);

                        // recoveredAt must NOT be overwritten
                        const afterSecond = await prisma.missedCall.findUnique({ where: { id: mc.id } });
                        expect(afterSecond.recoveredAt.getTime()).toBe(originalRecoveredAt.getTime());
                    } finally {
                        await cleanup(clinic.id);
                    }
                }
            ),
            { numRuns: 10 }
        );
    }, 30000);

    test('throws NOT_FOUND for non-existent missedCallId', async () => {
        const clinic = await createTestClinic('prop8c_notfound');
        try {
            await expect(
                markRecovered({ clinicId: clinic.id, missedCallId: 'nonexistent_id_xyz' })
            ).rejects.toMatchObject({ code: 'NOT_FOUND' });
        } finally {
            await prisma.clinic.delete({ where: { id: clinic.id } });
        }
    });
});

afterAll(async () => {
    await prisma.$disconnect();
});
