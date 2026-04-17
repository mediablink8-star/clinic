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
    if (/\b(book|ραντεβού|ραντεβου|κλείσ|κλεισ|appointment|κρατ|ορίσ|οριστ|θέλω να έρθω|θελω να ερθω|πότε μπορ|ποτε μπορ)\b/.test(t)) return 'BOOKING';

    // Callback keywords
    if (/\b(call|καλέσ|καλεσ|τηλέφ|τηλεφ|phone|ring|πάρτε|παρτε|επικοινων)\b/.test(t)) return 'CALLBACK';

    // Question keywords
    if (/\b(price|cost|τιμ|πόσο|ποσο|how much|ώρες|ωρες|hours|open|ανοιχτ|υπηρεσ|service|question|ερώτ|ερωτ|πληροφορ|info)\b/.test(t)) return 'QUESTION';

    return 'UNKNOWN';
}

module.exports = { detectIntent };
