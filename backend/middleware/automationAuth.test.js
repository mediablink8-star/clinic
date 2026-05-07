jest.mock('../services/authService', () => ({
    verifyToken: jest.fn(),
}));

jest.mock('../services/prisma', () => ({
    clinic: {
        findUnique: jest.fn(),
    },
}));

const automationAuth = require('./automationAuth');
const { verifyToken } = require('../services/authService');
const prisma = require('../services/prisma');

function createRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
}

describe('automationAuth', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects JWT auth for inactive clinic', async () => {
        verifyToken.mockReturnValue({ userId: 'user_1', clinicId: 'clinic_1', role: 'OWNER' });
        prisma.clinic.findUnique.mockResolvedValue({ id: 'clinic_1', isActive: false });

        const req = {
            headers: { authorization: 'Bearer token' },
            body: {},
            query: {},
        };
        const res = createRes();
        const next = jest.fn();

        await automationAuth(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            error: { code: 'CLINIC_INACTIVE', message: 'Clinic is not active' },
        });
        expect(next).not.toHaveBeenCalled();
    });
});
