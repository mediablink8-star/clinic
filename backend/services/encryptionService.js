const crypto = require('crypto');

// Derive a 32-byte key from the ENCRYPTION_KEY string
const encryptionSecret = process.env.DB_ENCRYPTION_KEY;

if (!encryptionSecret) {
    throw new Error('CRITICAL SECURITY ERROR: DB_ENCRYPTION_KEY must be set!');
}

const KEY = crypto.createHash('sha256').update(encryptionSecret).digest();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string using AES-256-GCM.
 * @param {string} text - The text to encrypt.
 * @returns {string} - Combined IV, Auth Tag, and Ciphertext in Hex.
 */
function encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a string encrypted with the above encrypt function.
 * @param {string} encryptedText - Combined IV, Auth Tag, and Ciphertext.
 * @returns {string} - Decrypted text.
 */
function decrypt(encryptedText) {
    if (!encryptedText) return '';
    try {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        if (!ivHex || !authTagHex || !encrypted) return '';

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        return '';
    }
}

module.exports = { encrypt, decrypt };
