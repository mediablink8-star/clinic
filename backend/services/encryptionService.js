const crypto = require('crypto');
const logger = require('../utils/logger');

// Derive 32-byte keys from env strings
const CURRENT_VERSION = process.env.DB_ENCRYPTION_KEY_VERSION || 'v1';

const KEY_V1 = (() => {
    const secret = process.env.DB_ENCRYPTION_KEY;
    if (!secret) throw new Error('CRITICAL SECURITY ERROR: DB_ENCRYPTION_KEY must be set!');
    return crypto.createHash('sha256').update(secret).digest();
})();

const KEY_V2 = process.env.DB_ENCRYPTION_KEY_V2
    ? crypto.createHash('sha256').update(process.env.DB_ENCRYPTION_KEY_V2).digest()
    : null;

const KEYS = { v1: KEY_V1, ...(KEY_V2 ? { v2: KEY_V2 } : {}) };
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string using AES-256-GCM.
 * Format: version:iv:authTag:ciphertext (all hex)
 */
function encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(16);
    const key = KEYS[CURRENT_VERSION];
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');
    return `${CURRENT_VERSION}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the encrypt function.
 * Reads the version prefix to select the correct key.
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;
    try {
        const parts = encryptedText.split(':');
        // Legacy format (v1, no version prefix): iv:authTag:ciphertext
        let version, ivHex, authTagHex, encrypted;
        if (parts.length === 3) {
            version = 'v1';
            [ivHex, authTagHex, encrypted] = parts;
        } else {
            [version, ivHex, authTagHex, encrypted] = parts;
        }

        const key = KEYS[version];
        if (!key) throw new Error(`Unknown key version: ${version}`);

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        logger.error('Decryption failed', { error: error.message });
        throw new Error(`Decryption failed: ${error.message}`);
    }
}

module.exports = { encrypt, decrypt, CURRENT_VERSION };
