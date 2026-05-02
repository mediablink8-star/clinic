const prisma = require('./prisma');

const GREEK_DAY_NAMES = [
    '\u039a\u03c5\u03c1\u03b9\u03b1\u03ba\u03ae',
    '\u0394\u03b5\u03c5\u03c4\u03ad\u03c1\u03b1',
    '\u03a4\u03c1\u03af\u03c4\u03b7',
    '\u03a4\u03b5\u03c4\u03ac\u03c1\u03c4\u03b7',
    '\u03a0\u03ad\u03bc\u03c0\u03c4\u03b7',
    '\u03a0\u03b1\u03c1\u03b1\u03c3\u03ba\u03b5\u03c5\u03ae',
    '\u03a3\u03ac\u03b2\u03b2\u03b1\u03c4\u03bf',
];

const EN_DAY_TO_KEY = {
    monday: 'weekdays',
    tuesday: 'weekdays',
    wednesday: 'weekdays',
    thursday: 'weekdays',
    friday: 'weekdays',
    saturday: 'saturday',
    sunday: 'sunday',
};

const EN_DAY_INDEX = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
};

function parseHoursRange(rangeStr) {
    if (!rangeStr || /closed/i.test(rangeStr)) return null;
    const match = rangeStr.match(/(\d{1,2}):(\d{2})\s*[-\u2013]\s*(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return {
        openHour: parseInt(match[1], 10),
        openMinute: parseInt(match[2], 10),
        closeHour: parseInt(match[3], 10),
        closeMinute: parseInt(match[4], 10),
    };
}

function resolveRangeForDate(workingHours, date, timezone = 'Europe/Athens') {
    if (!workingHours || typeof workingHours !== 'object') return null;

    const enDay = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: timezone,
    }).format(date).toLowerCase();

    const greekKey = GREEK_DAY_NAMES[EN_DAY_INDEX[enDay]];
    if (workingHours[greekKey]) return workingHours[greekKey];

    const shortKey = EN_DAY_TO_KEY[enDay] || enDay;
    const titleKey = enDay.charAt(0).toUpperCase() + enDay.slice(1);
    return workingHours[shortKey] || workingHours[enDay] || workingHours[titleKey] || workingHours.default || null;
}

function getLocalDateParts(date, timezone = 'Europe/Athens') {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'long',
    }).formatToParts(date).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {});

    return {
        dateKey: `${parts.year}-${parts.month}-${parts.day}`,
        weekday: parts.weekday,
        minutes: Number(parts.hour) * 60 + Number(parts.minute),
    };
}

function parseWorkingHours(clinic) {
    let workingHours = {};
    try {
        workingHours = typeof clinic?.workingHours === 'string'
            ? JSON.parse(clinic.workingHours || '{}')
            : (clinic?.workingHours || {});
    } catch {
        workingHours = {};
    }

    try {
        const aiConfig = typeof clinic?.aiConfig === 'string'
            ? JSON.parse(clinic.aiConfig || '{}')
            : (clinic?.aiConfig || {});
        if (aiConfig.workingHours && typeof aiConfig.workingHours === 'object') {
            workingHours = { ...workingHours, ...aiConfig.workingHours };
        }
    } catch {
        // Keep clinic.workingHours if AI config is malformed.
    }

    return workingHours;
}

function isWithinWorkingHours({ clinic, start, end, timezone = 'Europe/Athens' }) {
    const workingHours = parseWorkingHours(clinic);
    const startParts = getLocalDateParts(start, timezone);
    const endParts = getLocalDateParts(end, timezone);

    if (startParts.dateKey !== endParts.dateKey) return false;

    const rangeStr = resolveRangeForDate(workingHours, start, timezone);
    const parsed = parseHoursRange(rangeStr);
    if (!parsed) return false;

    const openMinutes = parsed.openHour * 60 + parsed.openMinute;
    const closeMinutes = parsed.closeHour * 60 + parsed.closeMinute;
    return startParts.minutes >= openMinutes && endParts.minutes <= closeMinutes;
}

async function getAvailableSlots(clinicId, date, timezone = 'Europe/Athens', stepMinutes = 60) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { workingHours: true, aiConfig: true },
    });
    if (!clinic) return [];

    const workingHours = parseWorkingHours(clinic);
    const rangeStr = resolveRangeForDate(workingHours, date, timezone);
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
        select: { startTime: true, endTime: true },
    });

    // Mark every slot occupied by each appointment (handles multi-hour appointments)
    const step = Math.max(15, stepMinutes);
    const bookedMinutes = new Set();
    for (const appt of existing) {
        const apptStart = new Date(appt.startTime);
        const apptEnd = new Date(appt.endTime);
        let cur = apptStart.getHours() * 60 + apptStart.getMinutes();
        const endMin = apptEnd.getHours() * 60 + apptEnd.getMinutes();
        while (cur < endMin) {
            bookedMinutes.add(cur);
            cur += step;
        }
    }

    const slots = [];
    const openMinutes = parsed.openHour * 60 + parsed.openMinute;
    const closeMinutes = parsed.closeHour * 60 + parsed.closeMinute;
    for (let m = openMinutes; m < closeMinutes; m += step) {
        if (!bookedMinutes.has(m)) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
        }
    }
    return slots;
}

module.exports = {
    parseHoursRange,
    resolveRangeForDate,
    isWithinWorkingHours,
    getAvailableSlots,
    getLocalDateParts,
};
