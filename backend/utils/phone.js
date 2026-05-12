/**
 * Canonical phone normalizer for Greek numbers.
 * Single source of truth — import this everywhere instead of duplicating.
 */
function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+');
    if (cleaned.startsWith('+30')) return cleaned;
    if (/^[26]/.test(cleaned)) return `+30${cleaned}`;
    if (cleaned.startsWith('0')) return `+30${cleaned.slice(1)}`;
    return cleaned;
}

/**
 * Format for Vonage API — requires only digits, no '+'
 */
function formatForVonage(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;
    return normalized.replace('+', '');
}

module.exports = { normalizePhone, formatForVonage };
