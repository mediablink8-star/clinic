/**
 * Shared date and time constants for the backend.
 */

const GREEK_DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];

const GREEK_DAY_MAP = {
    'δευτέρα': 1, 'δευτερα': 1,
    'τρίτη': 2, 'τριτη': 2,
    'τετάρτη': 3, 'τεταρτη': 3,
    'πέμπτη': 4, 'πεμπτη': 4,
    'παρασκευή': 5, 'παρασκευη': 5,
    'σάββατο': 6, 'σαββατο': 6,
    'κυριακή': 0, 'κυριακη': 0,
};

const DEFAULT_TIMEZONE = 'Europe/Athens';

module.exports = {
    GREEK_DAYS,
    GREEK_DAY_MAP,
    DEFAULT_TIMEZONE
};
