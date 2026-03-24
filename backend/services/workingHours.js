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
 * 
 * @param {Date} now
 * @param {object} workingHours  e.g. { "Δευτέρα": "09:00-17:00", ... }
 * @returns {{ withinHours: boolean, scheduledAt: Date|null }}
 *   - withinHours: true if SMS should be sent immediately
 *   - scheduledAt: Date for next 09:00 if outside hours (null when withinHours=true)
 */
function checkWorkingHours(now, workingHours) {
    // Default: send immediately if no config
    if (!workingHours || typeof workingHours !== 'object') {
        return { withinHours: true, scheduledAt: null };
    }

    const dayName = GREEK_DAYS[now.getDay()];
    const rangeStr = workingHours[dayName];
    const range = parseRange(rangeStr);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (range) {
        const openMinutes  = range.open.h  * 60 + range.open.m;
        const closeMinutes = range.close.h * 60 + range.close.m;

        if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
            return { withinHours: true, scheduledAt: null };
        }
    }

    // Outside hours — find next 09:00 on a working day
    const scheduled = getNextOpeningTime(now, workingHours);
    return { withinHours: false, scheduledAt: scheduled };
}

/**
 * Find the next 09:00 on a day that has working hours configured.
 * Looks up to 7 days ahead. Falls back to tomorrow 09:00 if nothing found.
 */
function getNextOpeningTime(now, workingHours) {
    for (let daysAhead = 1; daysAhead <= 7; daysAhead++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + daysAhead);
        candidate.setHours(9, 0, 0, 0);

        const dayName = GREEK_DAYS[candidate.getDay()];
        const rangeStr = workingHours[dayName];
        const range = parseRange(rangeStr);

        if (range) {
            // Use the clinic's actual open time if configured, otherwise 09:00
            candidate.setHours(range.open.h, range.open.m, 0, 0);
            return candidate;
        }
    }

    // Fallback: tomorrow 09:00
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    fallback.setHours(9, 0, 0, 0);
    return fallback;
}

module.exports = { checkWorkingHours, getNextOpeningTime };
