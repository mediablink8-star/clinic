import { DEFAULT_TIMEZONE } from '../lib/constants';
/**
 * Date and Time utilities for the ClinicFlow frontend.
 * Ensures consistent display in the clinic's configured timezone.
 */

/**
 * Formats a date/time string or object to a local string in the clinic's timezone.
 * @param {string|Date} date 
 * @param {string} timezone 
 * @param {Object} options 
 * @returns {string}
 */
export function formatInClinicTimezone(date, timezone = DEFAULT_TIMEZONE, options = {}) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('el-GR', {
        timeZone: timezone,
        ...options
    }).format(d);
}

/**
 * Gets the date part (YYYY-MM-DD) of a date in the clinic's timezone.
 * @param {string|Date} date 
 * @param {string} timezone 
 * @returns {string}
 */
export function getClinicDateKey(date, timezone = DEFAULT_TIMEZONE) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    // en-CA is a reliable locale for YYYY-MM-DD
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    return formatter.format(d);
}

/**
 * Gets the time part (HH:mm) of a date in the clinic's timezone.
 * @param {string|Date} date 
 * @param {string} timezone 
 * @returns {string}
 */
export function getClinicTimePart(date, timezone = DEFAULT_TIMEZONE) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';

    const formatter = new Intl.DateTimeFormat('el-GR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    
    return formatter.format(d);
}
