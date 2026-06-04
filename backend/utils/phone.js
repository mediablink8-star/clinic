/**
 * Canonical phone normalizer for Greek numbers.
 * Single source of truth — import this everywhere instead of duplicating.
 */
function normalizePhone(phone) {
    if (!phone) return '';
    const cleaned = phone.replace(/[\s\-\(\)]/g, '').replace(/^00/, '+');
    if (cleaned.startsWith('+30')) return cleaned;
    if (cleaned.startsWith('+')) return cleaned;
    if (/^[26]/.test(cleaned) && cleaned.length === 10) return `+30${cleaned}`;
    if (cleaned.startsWith('0')) return `+30${cleaned.slice(1)}`;
    return cleaned;
}

function digitsOnly(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

module.exports = { normalizePhone, digitsOnly };
