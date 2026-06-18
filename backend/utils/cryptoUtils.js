const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Timing-safe string comparison.
 * Always returns false on mismatch (never throws).
 */
function timingSafeEqualStr(a, b) {
    try {
        const aBuf = Buffer.from(String(a), 'utf8');
        const bBuf = Buffer.from(String(b), 'utf8');
        if (aBuf.length !== bBuf.length) return false;
        return crypto.timingSafeEqual(aBuf, bBuf);
    } catch {
        return false;
    }
}

/**
 * Decrypts a value that may be encrypted (iv:authTag:ciphertext format)
 * or may be plaintext (legacy/migration). Never throws.
 */
function decryptSafe(val) {
    if (!val) return null;
    try {
        if (val.includes(':')) {
            const { decrypt } = require('../services/encryptionService');
            return decrypt(val);
        }
        return val;
    } catch {
        return val;
    }
}

/**
 * Clinic fields that must be encrypted at rest.
 */
const ENCRYPTED_CLINIC_FIELDS = [
    'zadarmaApiKey',
    'zadarmaApiSecret',
    'geminiApiKey',
    'googleCalendarRefreshToken',
];

/**
 * Encrypts sensitive fields in a data object before writing to DB.
 * Skips values that are already encrypted (contain ':' separator).
 * Returns a new object — does not mutate the input.
 */
function encryptSensitiveFields(data) {
    const out = { ...data };
    for (const field of ENCRYPTED_CLINIC_FIELDS) {
        if (out[field] && typeof out[field] === 'string' && !out[field].includes(':')) {
            try {
                const { encrypt } = require('../services/encryptionService');
                out[field] = encrypt(out[field]);
            } catch (err) {
                logger.warn('Encryption failed for field', { field, error: err.message });
            }
        }
    }
    return out;
}

/**
 * Decrypts sensitive fields in a DB record before use.
 * Returns a new object — does not mutate the input.
 */
function decryptSensitiveFields(record) {
    if (!record) return record;
    const out = { ...record };
    for (const field of ENCRYPTED_CLINIC_FIELDS) {
        if (out[field]) {
            try {
                out[field] = decryptSafe(out[field]) || out[field];
            } catch {
                // leave as-is if decryption fails
            }
        }
    }
    return out;
}

module.exports = {
    timingSafeEqualStr,
    decryptSafe,
    encryptSensitiveFields,
    decryptSensitiveFields,
    ENCRYPTED_CLINIC_FIELDS,
};
