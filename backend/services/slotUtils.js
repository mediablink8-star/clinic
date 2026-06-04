const prisma = require('./prisma');
const { DEFAULT_TIMEZONE } = require('../utils/dateConstants');

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

function resolveRangeForDate(workingHours, dateInput, timezone = DEFAULT_TIMEZONE) {
    if (!workingHours || typeof workingHours !== 'object') return null;
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return null;

    // Helper to find key case-insensitively and accent-insensitively
    const findKey = (obj, target) => {
        const normalize = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
        const normalizedTarget = normalize(target);
        return Object.keys(obj).find(k => normalize(k) === normalizedTarget);
    };

    const enDay = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: timezone,
    }).format(date).toLowerCase();

    const greekKey = GREEK_DAY_NAMES[EN_DAY_INDEX[enDay]];
    const actualGreekKey = findKey(workingHours, greekKey);
    if (actualGreekKey) return workingHours[actualGreekKey];

    const shortKey = EN_DAY_TO_KEY[enDay] || enDay;
    const actualShortKey = findKey(workingHours, shortKey);
    if (actualShortKey) return workingHours[actualShortKey];

    const actualEnKey = findKey(workingHours, enDay);
    if (actualEnKey) return workingHours[actualEnKey];

    return workingHours.default || workingHours.Default || null;
}

function getLocalDateParts(date, timezone = DEFAULT_TIMEZONE) {
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

const { fromZonedTime, toZonedTime, formatInTimeZone } = require('date-fns-tz');

/**
 * Get the start of a day (00:00:00) in a specific timezone, returned as a UTC Date object.
 */
function getStartOfDay(date, timezone = DEFAULT_TIMEZONE) {
    // Force the date to be the correct day in the target timezone
    const zonedDate = toZonedTime(date, timezone);
    zonedDate.setHours(0, 0, 0, 0);
    return fromZonedTime(zonedDate, timezone);
}

/**
 * Get the start of a month in a specific timezone.
 */
function getStartOfMonth(date, timezone = DEFAULT_TIMEZONE) {
    const zonedDate = toZonedTime(date, timezone);
    zonedDate.setDate(1);
    zonedDate.setHours(0, 0, 0, 0);
    return fromZonedTime(zonedDate, timezone);
}

function parseWorkingHours(clinic, doctor = null) {
    if (doctor && doctor.workingHours) {
        try {
            let doctorHours = typeof doctor.workingHours === 'string'
                ? JSON.parse(doctor.workingHours)
                : doctor.workingHours;
            if (Object.keys(doctorHours).length > 0) {
                return doctorHours;
            }
        } catch {
            // fallback to clinic
        }
    }

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

function isWithinWorkingHours({ clinic, start, end, timezone = DEFAULT_TIMEZONE, doctor = null }) {
    const workingHours = parseWorkingHours(clinic, doctor);
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

async function getAvailableSlots(clinicId, date, timezone = DEFAULT_TIMEZONE, stepMinutes = 60, doctor = null) {
    const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: { workingHours: true, aiConfig: true, id: true },
    });
    if (!clinic) return [];

    // If no doctor specified, get slots for ALL active doctors and union them
    if (!doctor) {
        const activeDoctors = await prisma.doctor.findMany({
            where: { clinicId, isActive: true }
        });

        if (activeDoctors.length === 0) {
            // Fallback to clinic-level slots if no doctors exist
            return calculateSlots(clinic, null, date, timezone, stepMinutes, clinicId);
        }

        const allDoctorSlots = await Promise.all(
            activeDoctors.map(doc => calculateSlots(clinic, doc, date, timezone, stepMinutes, clinicId))
        );

        // Union of all unique slots across all doctors, sorted
        const uniqueSlots = [...new Set(allDoctorSlots.flat())].sort();
        return uniqueSlots;
    }

    return calculateSlots(clinic, doctor, date, timezone, stepMinutes, clinicId);
}

/**
 * Internal helper to calculate slots for a specific resource (Doctor or Clinic)
 */
async function calculateSlots(clinic, doctor, date, timezone, stepMinutes, clinicId) {
    const workingHours = parseWorkingHours(clinic, doctor);
    const rangeStr = resolveRangeForDate(workingHours, date, timezone);
    const parsed = parseHoursRange(rangeStr);

    if (!parsed) {
        console.warn(`[calculateSlots] No working hours found for date: ${date}, timezone: ${timezone}. Check clinic/doctor configuration.`);
        return [];
    }

    const startOfDay = getStartOfDay(new Date(date), timezone);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

    const whereClause = {
        clinicId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] }
    };
    
    if (doctor) {
        whereClause.doctorId = doctor.id;
    }

    // IMPORTANT: If no doctor is provided, we don't filter by doctorId: null.
    // We want to see ALL appointments for the clinic to see if the clinic/any doctor is busy.
    // The previous code had `whereClause.doctorId = null` which was a bug.

    const existing = await prisma.appointment.findMany({
        where: whereClause,
        select: { startTime: true, endTime: true },
        take: 200
    });

    const step = Math.max(15, stepMinutes);
    const bookedMinutes = new Set();
    for (const appt of existing) {
        const apptStartParts = getLocalDateParts(new Date(appt.startTime), timezone);
        const apptEndParts = getLocalDateParts(new Date(appt.endTime), timezone);
        for (let min = apptStartParts.minutes; min < apptEndParts.minutes; min++) {
            bookedMinutes.add(min);
        }
    }

    const now = new Date();
    const nowParts = getLocalDateParts(now, timezone);
    const isToday = getLocalDateParts(startOfDay, timezone).dateKey === nowParts.dateKey;

    const slots = [];
    const openMinutes = parsed.openHour * 60 + parsed.openMinute;
    const closeMinutes = parsed.closeHour * 60 + parsed.closeMinute;
    
    for (let m = openMinutes; m <= closeMinutes - step; m += step) {
        // Filter out booked slots — a slot is unavailable if ANY minute within its duration is booked
        let isFree = true;
        for (let i = 0; i < step; i++) {
            if (bookedMinutes.has(m + i)) {
                isFree = false;
                break;
            }
        }
        if (!isFree) continue;
        
        // If it's today, filter out past slots (allowing a 15-min buffer)
        if (isToday && m <= nowParts.minutes + 15) continue;

        const h = Math.floor(m / 60);
        const min = m % 60;
        slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
    }
    return slots;
}

module.exports = {
    parseHoursRange,
    resolveRangeForDate,
    isWithinWorkingHours,
    getAvailableSlots,
    getLocalDateParts,
    getStartOfDay,
    getStartOfMonth,
};
