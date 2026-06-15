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

const GREEK_TO_ENGLISH_MAP = {
    'αύριο': 'tomorrow', 'αυριο': 'tomorrow',
    'σήμερα': 'today', 'σημερα': 'today',
    'δευτέρα': 'monday', 'δευτερα': 'monday',
    'τρίτη': 'tuesday', 'τριτη': 'tuesday',
    'τετάρτη': 'wednesday', 'τεταρτη': 'wednesday',
    'πέμπτη': 'thursday', 'πεμπτη': 'thursday',
    'παρασκευή': 'friday', 'παρασκευη': 'friday',
    'σάββατο': 'saturday', 'σαββατο': 'saturday',
    'κυριακή': 'sunday', 'κυριακη': 'sunday',
    'στις': 'at', 'η ώρα': '',
    'το μεσημέρι': 'pm', 'το πρωί': 'am',
    'το απογευμα': 'pm', 'το βράδυ': 'pm'
};

function translateGreekDate(text) {
    if (!text) return text;
    let result = text;
    Object.entries(GREEK_TO_ENGLISH_MAP).forEach(([el, en]) => {
        const regex = new RegExp(el, 'gi');
        result = result.replace(regex, en);
    });
    return result;
}

module.exports = {
    GREEK_DAYS,
    GREEK_DAY_MAP,
    DEFAULT_TIMEZONE,
    GREEK_TO_ENGLISH_MAP,
    translateGreekDate
};
