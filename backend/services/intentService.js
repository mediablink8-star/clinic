/**
 * Simple keyword-based intent detection.
 * Returns: 'BOOKING' | 'QUESTION' | 'CALLBACK' | 'UNKNOWN'
 */
function detectIntent(text) {
    if (!text) return 'UNKNOWN';
    const t = text.trim().toLowerCase();

    // Exact number shortcuts
    if (t === '1') return 'BOOKING';
    if (t === '2') return 'QUESTION';
    if (t === '3') return 'CALLBACK';

    // Booking keywords (Greek + English)
    if (/\b(book|appointment)\b/.test(t) || /(ραντεβού|ραντεβου|κλείσ|κλεισ|κρατ|ορίσ|οριστ|θέλω να έρθω|θελω να ερθω|πότε μπορ|ποτε μπορ)/.test(t)) return 'BOOKING';

    // Callback keywords
    if (/\b(call|phone|ring)\b/.test(t) || /(καλέσ|καλεσ|τηλέφ|τηλεφ|πάρτε|παρτε|επικοινων)/.test(t)) return 'CALLBACK';

    // Question keywords
    if (/\b(price|cost|how much|hours|open|service|question|info)\b/.test(t) || /(τιμ|πόσο|ποσο|ώρες|ωρες|ανοιχτ|υπηρεσ|ερώτ|ερωτ|πληροφορ)/.test(t)) return 'QUESTION';

    return 'UNKNOWN';
}

module.exports = { detectIntent };
