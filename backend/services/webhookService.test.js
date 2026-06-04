process.env.DB_ENCRYPTION_KEY = 'test_key_for_jest_tests_only';

jest.mock('https', () => ({
    request: jest.fn(),
}));

const https = require('https');
const { triggerWebhook } = require('./webhookService');

describe('webhookService', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    test('sends both HMAC signature and workflow key headers', async () => {
        https.request.mockImplementation((options, callback) => {
            const handlers = {};
            const response = {
                statusCode: 204,
                on: jest.fn((event, handler) => {
                    handlers[event] = handler;
                    return response;
                }),
            };
            const request = {
                on: jest.fn(),
                setTimeout: jest.fn(),
                write: jest.fn(),
                end: jest.fn(() => {
                    callback(response);
                    handlers.end();
                }),
            };
            return request;
        });

        const result = await triggerWebhook(
            'appointment.created',
            { appointmentId: 'appt_1' },
            'https://example.test/webhook',
            'shared-secret'
        );

        expect(result.success).toBe(true);
        expect(https.request).toHaveBeenCalledTimes(1);

        const [options] = https.request.mock.calls[0];
        expect(options.headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/);
        expect(options.headers['X-Webhook-Key']).toBe('shared-secret');
        expect(options.headers['X-API-Key']).toBeUndefined();
        expect(options.rejectUnauthorized).toBeUndefined();
        const body = https.request.mock.results[0].value.write.mock.calls[0][0];
        expect(body).not.toContain('shared-secret');
    });
});
