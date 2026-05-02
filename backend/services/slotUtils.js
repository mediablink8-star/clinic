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

async function getAvailableSlots(clinicId, date, timezone = 'Europe/Athens') {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { workingHours: true },
    });
    if (!clinic) return [];

    let wh = {};
    try {
        wh = typeof clinic.workingHours === 'string' ? JSON.parse(clinic.workingHours) : clinic.workingHours;
    } catch { return []; }

    const rangeStr = resolveRangeForDate(wh, date);
    const parsed = parseHoursRange(rangeStr);
    if (!parsed) return [];

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findMany({
        where: {
            clinicId,
            startTime: { gte: dayStart, lte: dayEnd },
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        },
        select: { startTime: true },
    });

    const bookedHours = new Set(
        existing.map(a => {
            const d = new Date(a.startTime);
            return d.getHours();
        })
    );

    const slots = [];
    for (let h = parsed.openHour; h < parsed.closeHour; h++) {
        if (!bookedHours.has(h)) {
            slots.push(`${String(h).padStart(2, '0')}:00`);
        }
    }
    return slots;
}

module.exports = {
    parseHoursRange,
    resolveRangeForDate,
    isWithinWorkingHours,
    getAvailableSlots
};