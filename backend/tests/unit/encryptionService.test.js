const { encrypt, decrypt } = require('../../services/encryptionService');

describe('Encryption Service', () => {
  const originalKey = process.env.DB_ENCRYPTION_KEY;
  
  beforeAll(() => {
    // Use a 32-byte key for AES-256-GCM
    process.env.DB_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';
  });

  afterAll(() => {
    process.env.DB_ENCRYPTION_KEY = originalKey;
  });

  it('should encrypt and decrypt string', () => {
    const plaintext = 'sensitive-data-123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const plaintext = 'same-data';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty string', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe('');
  });

  it('should handle special characters', () => {
    const plaintext = 'AMKA: 12345678901 @#$%^&*()';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should handle unicode (Greek characters)', () => {
    const plaintext = 'ΑΜΚΑ: 12345678901 - Ιωάννης Παπαδόπουλος';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should throw on invalid ciphertext', () => {
    expect(() => decrypt('invalid-ciphertext')).toThrow();
  });

  it('should throw on tampered ciphertext', () => {
    const plaintext = 'original-data';
    const encrypted = encrypt(plaintext);
    
    // Tamper with the ciphertext
    const parts = encrypted.split(':');
    parts[2] = 'tampered';
    const tampered = parts.join(':');
    
    expect(() => decrypt(tampered)).toThrow();
  });

  it('should handle long strings', () => {
    const plaintext = 'x'.repeat(10000);
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });

  it('should include IV and auth tag in output', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    
    expect(parts.length).toBe(3); // iv:ciphertext:authTag
    expect(parts[0]).toHaveLength(24); // 12 bytes IV = 24 hex chars
    expect(parts[2]).toHaveLength(32); // 16 bytes auth tag = 32 hex chars
  });
});