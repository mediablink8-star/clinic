const crypto = require('crypto');
const webhookAuth = require('./webhookAuth');

function createRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
}

describe('webhookAuth', () => {
    const originalEnv = process.env.WEBHOOK_SECRET;

    beforeEach(() => {
        process.env.WEBHOOK_SECRET = 'test-secret';
    });

    afterEach(() => {
        process.env.WEBHOOK_SECRET = originalEnv;
        jest.clearAllMocks();
    });

    test('returns 401 on malformed signature length mismatch', async () => {
        const req = {
            headers: { 'x-webhook-signature': 'abc' },
            body: { foo: 'bar' },
            rawBody: '{"foo":"bar"}',
        };
        const res = createRes();
        const next = jest.fn();

        await webhookAuth(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        const error = next.mock.calls[0][0];
        expect(error.status).toBe(401);
        expect(error.code).toBe('UNAUTHORIZED');
    });

    test('accepts valid signature', async () => {
        const rawBody = '{"foo":"bar"}';
        const signature = crypto
            .createHmac('sha256', process.env.WEBHOOK_SECRET)
            .update(rawBody)
            .digest('hex');

        const req = {
            headers: { 'x-webhook-signature': signature },
            body: { foo: 'bar' },
            rawBody,
        };
        const res = createRes();
        const next = jest.fn();

        await webhookAuth(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });
});
