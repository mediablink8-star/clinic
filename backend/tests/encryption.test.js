const crypto = require('crypto');

describe('Encryption Service', () => {
    let encrypt, decrypt;

    beforeAll(() => {
        process.env.DB_ENCRYPTION_KEY = 'test-encryption-key-for-tests-only';
        const service = require('../services/encryptionService');
        encrypt = service.encrypt;
        decrypt = service.decrypt;
    });

    test('encrypt returns non-empty string', () => {
        const result = encrypt('hello world');
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
    });

    test('decrypt returns original value', () => {
        const original = 'secret-api-key-12345';
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    test('decrypt throws on invalid data', () => {
        expect(() => decrypt('invalid:data:here')).toThrow('Decryption failed');
    });

    test('decrypt returns null for empty input', () => {
        expect(decrypt('')).toBeNull();
        expect(decrypt(null)).toBeNull();
        expect(decrypt(undefined)).toBeNull();
    });

    test('each encryption produces different ciphertext (random IV)', () => {
        const original = 'same-value';
        const enc1 = encrypt(original);
        const enc2 = encrypt(original);
        expect(enc1).not.toBe(enc2);
        expect(decrypt(enc1)).toBe(original);
        expect(decrypt(enc2)).toBe(original);
    });
});
