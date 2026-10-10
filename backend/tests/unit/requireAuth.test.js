jest.mock('../../services/prisma', () => ({
    user: { findUnique: jest.fn() },
    clinic: { findUnique: jest.fn() },
}));
jest.mock('../../services/authService', () => ({
    verifyToken: jest.fn(),
}));

const prisma = require('../../services/prisma');
const { verifyToken } = require('../../services/authService');
const { requireAuth } = require('../../middleware/requireAuth');

describe('requireAuth tenant membership validation', () => {
    const decoded = { userId: 'user-1', clinicId: 'clinic-1', role: 'OWNER' };
    let req;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();
        req = { headers: { authorization: 'Bearer access-token' } };
        next = jest.fn();
        verifyToken.mockReturnValue(decoded);
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            clinicId: 'clinic-1',
            role: 'ASSISTANT',
        });
        prisma.clinic.findUnique.mockResolvedValue({ id: 'clinic-1', isActive: true });
    });

    it('uses the current database role instead of a stale token role', async () => {
        await requireAuth(req, {}, next);

        expect(next).toHaveBeenCalledWith();
        expect(req.clinicId).toBe('clinic-1');
        expect(req.user.role).toBe('ASSISTANT');
    });

    it('rejects an access token for a user who has been deleted', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        await requireAuth(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
        expect(req.clinicId).toBeUndefined();
    });

    it('rejects a token when the user no longer belongs to its clinic', async () => {
        prisma.user.findUnique.mockResolvedValue({
            id: 'user-1',
            clinicId: 'clinic-2',
            role: 'OWNER',
        });

        await requireAuth(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
        expect(req.clinicId).toBeUndefined();
    });

    it('rejects a token that has no clinic association', async () => {
        verifyToken.mockReturnValue({ userId: 'user-1', role: 'OWNER' });

        await requireAuth(req, {}, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
});
