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

const { GREEK_DAYS, DEFAULT_TIMEZONE } = require('../utils/dateConstants');
const { getLocalDateParts, getStartOfDay, parseDateTimeInTimezone } = require('./slotUtils');

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
    if (!rangeStr) return null;

    if (typeof rangeStr === 'object') {
        if (rangeStr.closed === true) return null;
        const open = parseTime(rangeStr.open);
        const close = parseTime(rangeStr.close);
        return open && close ? { open, close } : null;
    }

    if (typeof rangeStr !== 'string' || !rangeStr.includes('-') || /closed/i.test(rangeStr)) return null;
    const [openStr, closeStr] = rangeStr.split('-');
    const open = parseTime(openStr.trim());
    const close = parseTime(closeStr.trim());
    if (!open || !close) return null;
    return { open, close };
}

const ENGLISH_DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getRangeConfig(workingHours, weekday) {
    let hours = workingHours;
    if (typeof hours === 'string') {
        try { hours = JSON.parse(hours); } catch { return { configured: false, rangeStr: null }; }
    }
    if (!hours || typeof hours !== 'object') return { configured: false, rangeStr: null };

    const index = ENGLISH_DAYS.indexOf(String(weekday).toLowerCase());
    const greekKey = index >= 0 ? GREEK_DAYS[index] : null;
    const keys = [greekKey, String(weekday).toLowerCase(), String(weekday).toLowerCase().slice(0, 3)].filter(Boolean);
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(hours, key)) {
            return { configured: true, rangeStr: hours[key] };
        }
    }
    if (Object.prototype.hasOwnProperty.call(hours, 'weekdays')) {
        return { configured: true, rangeStr: hours.weekdays };
    }
    if (Object.prototype.hasOwnProperty.call(hours, 'default') || Object.prototype.hasOwnProperty.call(hours, 'Default')) {
        return { configured: true, rangeStr: hours.default ?? hours.Default };
    }
    return { configured: false, rangeStr: null };
}

/**
 * Check if `now` falls within the clinic's working hours.
 */
function checkWorkingHours(now, workingHours, timezone = DEFAULT_TIMEZONE) {
    if (!workingHours) return { withinHours: true, scheduledAt: null };

    const { weekday, minutes } = getLocalDateParts(now, timezone);
    const config = getRangeConfig(workingHours, weekday);
    if (!config.configured) return { withinHours: true, scheduledAt: null };

    const range = parseRange(config.rangeStr);
    if (range) {
        const openMinutes = range.open.h * 60 + range.open.m;
        const closeMinutes = range.close.h * 60 + range.close.m;
        if (minutes >= openMinutes && minutes < closeMinutes) {
            return { withinHours: true, scheduledAt: null };
        }
    }

    return { withinHours: false, scheduledAt: getNextOpeningTime(now, workingHours, timezone) };
}

/**
 * Check if a given local date (in the clinic timezone) is a Greek holiday.
 * Returns the holiday record or null.
 */
async function isHoliday(date, country = 'GR') {
    const prisma = require('./prisma');
    const { getStartOfDay } = require('./slotUtils');
    const startOfDay = getStartOfDay(date);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    return prisma.holiday.findFirst({
        where: {
            country,
            date: { gte: startOfDay, lt: endOfDay }
        }
    });
}

/**
 * Async wrapper that checks both working hours AND Greek holidays.
 * A holiday is treated as outside-hours — next opening time is returned.
 */
async function checkClinicAvailability(now, workingHours, timezone = DEFAULT_TIMEZONE) {
    // Second argument is the country code, not the timezone. Passing the
    // timezone here made the query look for Holiday.country = 'Europe/Athens',
    // which never matches, so holiday closures were silently ignored.
    const holiday = await isHoliday(now, 'GR');
    if (holiday) {
        const scheduled = getNextOpeningTime(now, workingHours, timezone);
        return {
            withinHours: false,
            scheduledAt: scheduled,
            reason: 'holiday',
            holiday
        };
    }
    const result = checkWorkingHours(now, workingHours, timezone);
    return { ...result, reason: result.withinHours ? 'open' : 'off-hours' };
}

/**
 * Find the next 09:00 on a day that has working hours configured.
 */
function getNextOpeningTime(now, workingHours, timezone = DEFAULT_TIMEZONE) {
    for (let daysAhead = 1; daysAhead <= 7; daysAhead += 1) {
        const probe = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
        const { dateKey, weekday } = getLocalDateParts(probe, timezone);
        const config = getRangeConfig(workingHours, weekday);
        const range = config.configured ? parseRange(config.rangeStr) : null;
        if (!range) continue;

        const openTime = `${String(range.open.h).padStart(2, '0')}:${String(range.open.m).padStart(2, '0')}`;
        const scheduled = parseDateTimeInTimezone(dateKey, openTime, timezone);
        if (scheduled.getTime() > now.getTime()) return scheduled;
    }

    const nextProbe = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { dateKey } = getLocalDateParts(nextProbe, timezone);
    return parseDateTimeInTimezone(dateKey, '09:00', timezone);
}
/**
 * Check if appointment start/end times are within clinic working hours.
 */
function isWithinWorkingHours({ clinic, start, end, timezone = clinic?.timezone || DEFAULT_TIMEZONE, doctor }) {
    const doctorConfig = getRangeConfig(doctor?.workingHours, getLocalDateParts(start, timezone).weekday);
    const clinicConfig = getRangeConfig(clinic?.workingHours, getLocalDateParts(start, timezone).weekday);
    const config = doctorConfig.configured ? doctorConfig : clinicConfig;

    // If neither schedule defines this day, keep the legacy permissive behavior.
    if (!config.configured) return true;

    const range = parseRange(config.rangeStr);
    if (!range) return false;

    const startParts = getLocalDateParts(start, timezone);
    const endParts = getLocalDateParts(end, timezone);
    if (startParts.dateKey !== endParts.dateKey) return false;

    const openMinutes = range.open.h * 60 + range.open.m;
    const closeMinutes = range.close.h * 60 + range.close.m;
    return startParts.minutes >= openMinutes && endParts.minutes <= closeMinutes;
}
module.exports = { checkWorkingHours, getNextOpeningTime, isWithinWorkingHours, checkClinicAvailability, isHoliday };
