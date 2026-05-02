const { triggerWebhook } = require('./webhookService');

describe('webhookService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
        jest.restoreAllMocks();
    });

    test('sends both HMAC signature and workflow key headers', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true });

        const result = await triggerWebhook(
            'appointment.created',
            { appointmentId: 'appt_1' },
            'https://example.test/webhook',
            'shared-secret'
        );

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        const [, options] = global.fetch.mock.calls[0];
        expect(options.headers['X-Webhook-Signature']).toMatch(/^[a-f0-9]{64}$/);
        expect(options.headers['X-Webhook-Key']).toBe('shared-secret');
    });
});
