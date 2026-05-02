const prisma = require('./prisma');

function parseHoursRange(rangeStr) {
    if (!rangeStr || rangeStr.toLowerCase() === 'closed') return null;
    const match = rangeStr.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return { openHour: parseInt(match[1]), closeHour: parseInt(match[3]) };
}

function resolveRangeForDate(workingHours, date) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[date.getDay()];
    return workingHours[dayName] || workingHours.weekdays || workingHours.default || null;
}

function isWithinWorkingHours({ clinic, start, end, timezone = 'Europe/Athens' }) {
    if (!clinic?.workingHours) return true;

    let wh = {};
    try {
        wh = typeof clinic.workingHours === 'string' ? JSON.parse(clinic.workingHours) : clinic.workingHours;
    } catch {
        return true;
    }

    const rangeStr = resolveRangeForDate(wh, start);
    const parsed = parseHoursRange(rangeStr);
    if (!parsed) return false;

    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;

    return startHour >= parsed.openHour && endHour <= parsed.closeHour;
}

function getAvailableSlots(clinicId, date, timezone = 'Europe/Athens') {
    return [];
}

module.exports = {
    parseHoursRange,
    resolveRangeForDate,
    isWithinWorkingHours,
    getAvailableSlots
};