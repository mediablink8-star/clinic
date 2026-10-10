const { publicBookingSchema } = require('./validationService');

const validBase = {
    clinicId: 'clinic_123',
    name: 'Test Patient',
    phone: '6912345678',
};

describe('publicBookingSchema', () => {
    test('accepts a booking with a date and time plus a CAPTCHA token', () => {
        const { error, value } = publicBookingSchema.validate({
            ...validBase,
            date: '2026-10-12',
            time: '10:30',
            recaptchaToken: 'captcha-token',
        });

        expect(error).toBeUndefined();
        expect(value.recaptchaToken).toBe('captcha-token');
    });

    test('rejects a date without a time', () => {
        const { error } = publicBookingSchema.validate({
            ...validBase,
            date: '2026-10-12',
        });

        expect(error).toBeDefined();
    });

    test('rejects a time without a date', () => {
        const { error } = publicBookingSchema.validate({
            ...validBase,
            time: '10:30',
        });

        expect(error).toBeDefined();
    });

    test('accepts an ISO startTime without separate date/time fields', () => {
        const { error } = publicBookingSchema.validate({
            ...validBase,
            startTime: '2026-10-12T07:30:00.000Z',
        });

        expect(error).toBeUndefined();
    });

    test('rejects oversized CAPTCHA tokens', () => {
        const { error } = publicBookingSchema.validate({
            ...validBase,
            date: '2026-10-12',
            time: '10:30',
            recaptchaToken: 'x'.repeat(4097),
        });

        expect(error).toBeDefined();
    });
});
