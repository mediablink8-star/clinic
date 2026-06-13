/**
 * Frontend Sentry PII scrubber — mirrors the backend logic to keep Greek
 * patient data out of the session-replay breadcrumb trail.
 */

const GREEK_MOBILE_RE = /(\+30\s?)?6\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g;
const AMKA_RE = /\b\d{11}\b/g;
const EMAIL_RE = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g;

const PII_KEY_FRAGMENTS = [
    'password', 'token', 'secret', 'authorization', 'amka', 'phone',
    'email', 'name', 'address', 'patient', 'card', 'cvv', 'pin', 'ssn',
    'τηλέφωνο', 'ασθενής', 'κωδικός', 'email', 'όνομα', 'διεύθυνση',
    'credit', 'iban', 'swift'
];

function scrubString(value) {
    if (typeof value !== 'string') return value;
    return value
        .replace(GREEK_MOBILE_RE, '[PHONE]')
        .replace(AMKA_RE, '[AMKA]')
        .replace(EMAIL_RE, '[EMAIL]')
        .replace(BEARER_RE, 'Bearer [REDACTED]')
        .replace(JWT_RE, '[JWT]');
}

function scrubValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return scrubString(value);
    if (Array.isArray(value)) return value.map(scrubValue);
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            const lower = k.toLowerCase();
            const isPiiKey = PII_KEY_FRAGMENTS.some(f => lower.includes(f));
            out[k] = isPiiKey ? '[REDACTED]' : scrubValue(v);
        }
        return out;
    }
    return value;
}

export function createBeforeSend() {
    return function beforeSend(event) {
        try {
            if (event.message) event.message = scrubString(event.message);
            if (event.extra) event.extra = scrubValue(event.extra);
            if (event.tags) event.tags = scrubValue(event.tags);
            if (event.user) {
                if (event.user.email) event.user.email = '[REDACTED]';
                if (event.user.ip_address) event.user.ip_address = '[REDACTED]';
                if (event.user.username) event.user.username = '[REDACTED]';
            }
            if (event.request) {
                if (event.request.cookies) event.request.cookies = '[REDACTED]';
                if (event.request.headers) {
                    event.request.headers = Object.fromEntries(
                        Object.entries(event.request.headers).map(([k, v]) =>
                            ['authorization', 'cookie'].includes(k.toLowerCase())
                                ? [k, '[REDACTED]']
                                : [k, scrubString(String(v))]
                        )
                    );
                }
                if (event.request.data) event.request.data = scrubValue(event.request.data);
            }
            if (event.breadcrumbs) {
                event.breadcrumbs = event.breadcrumbs.map(b => ({
                    ...b,
                    message: b.message ? scrubString(b.message) : b.message,
                    data: b.data ? scrubValue(b.data) : b.data
                }));
            }
        } catch (err) {
            // Never let scrubbing break error reporting
        }
        return event;
    };
}

export function scrubStringSafe(value) { return scrubString(value); }
export function scrubValueSafe(value) { return scrubValue(value); }
