const { normalizePhone, digitsOnly } = require('../utils/phone');

describe('Phone Utilities', () => {
    describe('normalizePhone', () => {
        test('strips spaces and dashes', () => {
            expect(normalizePhone('+30 210 123 4567')).toBe('+302101234567');
            expect(normalizePhone('+30-210-123-4567')).toBe('+302101234567');
        });

        test('preserves leading plus', () => {
            expect(normalizePhone('+1234567890')).toBe('+1234567890');
        });

        test('handles empty input', () => {
            expect(normalizePhone('')).toBe('');
            expect(normalizePhone(null)).toBe('');
            expect(normalizePhone(undefined)).toBe('');
        });

        test('strips non-digit characters except plus', () => {
            expect(normalizePhone('+30 (210) 123-4567')).toBe('+302101234567');
        });
    });

    describe('digitsOnly', () => {
        test('removes all non-digit characters', () => {
            expect(digitsOnly('+30 210 123 4567')).toBe('302101234567');
            expect(digitsOnly('(210) 123-4567')).toBe('2101234567');
        });

        test('handles empty input', () => {
            expect(digitsOnly('')).toBe('');
            expect(digitsOnly(null)).toBe('');
        });
    });
});
