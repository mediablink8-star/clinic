/**
 * Working Hours Guard
 * 
 * Determines whether the current time is within the clinic's configured
 * working hours. If not, returns the next 09:00 send time.
 * 
 * workingHours format (from aiConfig or clinic.workingHours):
 *   { "Δευτέρα": "09:00-17:00", "Τρίτη": "09:00-17:00", ... }
 * 
 * Day keys match the Greek day names used in AISettings.
 */

const GREEK_DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
const { getLocalDateParts, getStartOfDay } = require('./slotUtils');

/**
 * Parse "HH:MM" into { h, m }
 */
function parseTime(str) {
    if (!str) return null;
    const [h, m] = str.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return { h, m };
}

/**
 * Parse a range string like "09:00-17:00" into { open, close }
 */
function parseRange(rangeStr) {
    if (!rangeStr || !rangeStr.includes('-')) return null;
    const [openStr, closeStr] = rangeStr.split('-');
    const open = parseTime(openStr.trim());
    const close = parseTime(closeStr.trim());
    if (!open || !close) return null;
    return { open, close };
}

/**
 * Check if `now` falls within the clinic's working hours.
 */
function checkWorkingHours(now, workingHours, timezone = 'Europe/Athens') {
    if (!workingHours || typeof workingHours !== 'object') {
        return { withinHours: true, scheduledAt: null };
    }

    const { weekday, minutes } = getLocalDateParts(now, timezone);
    const rangeStr = workingHours[weekday];
    const range = parseRange(rangeStr);

    if (range) {
        const openMinutes  = range.open.h  * 60 + range.open.m;
        const closeMinutes = range.close.h * 60 + range.close.m;

        if (minutes >= openMinutes && minutes < closeMinutes) {
            return { withinHours: true, scheduledAt: null };
        }
    }

    // Outside hours — find next 09:00 on a working day
    const scheduled = getNextOpeningTime(now, workingHours, timezone);
    return { withinHours: false, scheduledAt: scheduled };
}

/**
 * Find the next 09:00 on a day that has working hours configured.
 */
function getNextOpeningTime(now, workingHours, timezone = 'Europe/Athens') {
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        let candidate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        candidate = getStartOfDay(candidate, timezone);
        candidate.setHours(9, 0, 0, 0);

        const { weekday } = getLocalDateParts(candidate, timezone);
        const rangeStr = workingHours[weekday];
        const range = parseRange(rangeStr);

        if (range) {
            // Re-calculate exactly based on timezone
            const iso = candidate.toISOString().split('T')[0];
            const h = String(range.open.h).padStart(2, '0');
            const m = String(range.open.m).padStart(2, '0');
            
            // This is still slightly tricky without Luxon, but let's use the same offset trick
            const offsetParts = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                timeZoneName: 'longOffset'
            }).formatToParts(candidate);
            
            const offsetMatch = offsetParts.find(p => p.type === 'timeZoneName').value.match(/GMT([-+]\d{1,2}):?(\d{2})?/);
            if (offsetMatch) {
                const sign = offsetMatch[1].startsWith('+') ? '-' : '+';
                const offH = offsetMatch[1].replace(/[-+]/, '').padStart(2, '0');
                const offM = (offsetMatch[2] || '00').padStart(2, '0');
                return new Date(`${iso}T${h}:${m}:00${sign}${offH}:${offM}`);
            }
            return candidate;
        }
    }

    const fallback = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return getStartOfDay(fallback, timezone);
}

/**
 * Check if appointment start/end times are within clinic working hours.
 */
function isWithinWorkingHours({ clinic, start, end }) {
    if (!clinic?.workingHours) return true;

    let wh = {};
    try {
        wh = typeof clinic.workingHours === 'string' ? JSON.parse(clinic.workingHours) : clinic.workingHours;
    } catch {
        return true;
    }

    const dayName = GREEK_DAYS[start.getDay()];
    const rangeStr = wh[dayName] || wh.weekdays || wh.default || null;

    if (!rangeStr || rangeStr.toLowerCase() === 'closed') return false;

    const parsed = parseRange(rangeStr);
    if (!parsed) return true;

    const currentMinutesStart = start.getHours() * 60 + start.getMinutes();
    const currentMinutesEnd = end.getHours() * 60 + end.getMinutes();

    const openMinutes = parsed.open.h * 60 + parsed.open.m;
    const closeMinutes = parsed.close.h * 60 + parsed.close.m;

    return currentMinutesStart >= openMinutes && currentMinutesEnd <= closeMinutes;
}

module.exports = { checkWorkingHours, getNextOpeningTime, isWithinWorkingHours };
