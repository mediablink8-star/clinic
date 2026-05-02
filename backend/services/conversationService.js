/**
 * Smart SMS conversation state machine.
 * All outbound SMS go through sendManagedSms for credit deduction and logging.
 */
const prisma = require('./prisma');
const { detectIntent } = require('./intentService');
const { checkWorkingHours } = require('./workingHours');
const { sendManagedSms } = require('./messagingService');
const { createAppointment } = require('./appointmentService');
const { normalizePhone } = require('../utils/phone');

// Restore getTemplate which was removed in the normalizePhone cleanup
function getTemplate(clinic, key, fallback) {
    try {
        const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        return (ai[key] && ai[key].trim()) ? ai[key] : fallback;
    } catch {
        return fallback;
    }
}

const SYSTEM_ACTOR = { userId: 'system-conversation', ip: 'auto' };

function stripGreekAccents(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

const greekWeekdays = [
    ['κυριακη', 0],
    ['δευτερα', 1],
    ['τριτη', 2],
    ['τεταρτη', 3],
    ['πεμπτη', 4],
    ['παρασκευη', 5],
    ['σαββατο', 6],
];

function nextWeekdayDate(targetDay, baseDate = new Date(), forceNextWeek = false) {
    const date = new Date(baseDate);
    let daysUntil = (targetDay - date.getDay() + 7) % 7;
    if (daysUntil === 0 || forceNextWeek) daysUntil += 7;
    date.setDate(date.getDate() + daysUntil);
    date.setHours(9, 0, 0, 0);
    return date;
}

function parseAppointmentDay(dayText, baseDate = new Date()) {
    const normalized = stripGreekAccents(dayText);
    const date = new Date(baseDate);
    date.setHours(9, 0, 0, 0);

    if (normalized.includes('σημερα') || normalized.includes('today')) return date;
    if (normalized.includes('αυριο') || normalized.includes('tomorrow')) {
        date.setDate(date.getDate() + 1);
        return date;
    }
    if (normalized.includes('μεθαυριο')) {
        date.setDate(date.getDate() + 2);
        return date;
    }
    if (normalized.includes('αλλη εβδομαδα') || normalized.includes('επομενη εβδομαδα') || normalized.includes('next week')) {
        date.setDate(date.getDate() + 7);
        return date;
    }

    const match = greekWeekdays.find(([name]) => normalized.includes(name));
    if (match) return nextWeekdayDate(match[1], baseDate, normalized.includes('αλλη') || normalized.includes('επομενη'));

    return null;
}

function parseAppointmentTime(timeText) {
    const match = (timeText || '').match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return null;
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2] || '0', 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute };
}

async function sendReply(clinic, phone, message) {
    try {
        await sendManagedSms({
            clinicId: clinic.id,
            clinic,
            eventType: 'conversation.reply',
            payload: { phone, message, clinicId: clinic.id },
            logType: 'CONVERSATION',
        });
    } catch (err) {
        console.warn(`[Conversation] sendReply failed for ${phone}: ${err.message}`);
        const mc = await prisma.missedCall.findFirst({
            where: { clinicId: clinic.id, fromNumber: normalizePhone(phone), status: { in: ['DETECTED', 'RECOVERING'] } }
        });
        if (mc) {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { smsError: err.message }
            });
        }
    }
}

function shouldReplyNow(clinic) {
    try {
        const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        const { withinHours } = checkWorkingHours(new Date(), ai.workingHours || null);
        return withinHours;
    } catch {
        return true;
    }
}

function outsideHoursMessage(clinic) {
    try {
        const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        const { scheduledAt } = checkWorkingHours(new Date(), ai.workingHours || null);
        const timeStr = scheduledAt
            ? scheduledAt.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })
            : '09:00';
        return `Ευχαριστούμε για το μήνυμά σας! Θα σας απαντήσουμε αύριο στις ${timeStr} 😊`;
    } catch {
        return 'Ευχαριστούμε! Θα σας απαντήσουμε κατά τις ώρες λειτουργίας 😊';
    }
}

function buildClinicInfo(clinic) {
    try {
        const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        const parts = [];
        if (ai.services) parts.push(`Υπηρεσίες: ${ai.services}`);
        if (ai.workingHours) parts.push(`Ώρες: ${typeof ai.workingHours === 'string' ? ai.workingHours : JSON.stringify(ai.workingHours)}`);
        if (clinic.location) parts.push(`Διεύθυνση: ${clinic.location}`);
        return parts.length > 0 ? parts.join('\n') : null;
    } catch {
        return null;
    }
}

async function handleInboundReply({ clinicId, fromPhone, messageBody, missedCallId }) {
    if (!missedCallId) return;
    const normalizedFromPhone = normalizePhone(fromPhone);

    const mc = await prisma.missedCall.findUnique({
        where: { id: missedCallId },
        include: { clinic: true, patient: true }
    });
    if (!mc || mc.clinicId !== clinicId) return;

    const clinic = mc.clinic;
    const state = mc.conversationState || 'NEW';
    const text = (messageBody || '').trim();

    console.log(`[Conversation] case=${mc.id} state=${state} from=${normalizedFromPhone} msg="${text.slice(0, 50)}"`);

    if (!shouldReplyNow(clinic)) {
        sendReply(clinic, normalizedFromPhone, outsideHoursMessage(clinic));
        return;
    }

    if (state === 'BOOKING') {
        return handleBookingStep(mc, clinic, text, normalizedFromPhone);
    }

    if (state === 'QUESTION') {
        const lowerText = stripGreekAccents(text);
        if (lowerText === '1' || lowerText.includes('ναι') || lowerText.includes('yes')) {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { conversationState: 'BOOKING', bookingStep: 'ASKED_NAME', status: 'RECOVERING' }
            });
            sendReply(clinic, normalizedFromPhone, 'Τέλεια! 😊 Πώς σας λένε;');
            return;
        }
        if (lowerText === '2' || lowerText.includes('οχι') || lowerText.includes('no')) {
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { conversationState: 'COMPLETED', status: 'RECOVERING' }
            });
            sendReply(clinic, normalizedFromPhone, 'Εντάξει! Αν χρειαστείτε κάτι, είμαστε εδώ 😊');
            return;
        }
        const clinicInfo = buildClinicInfo(clinic);
        const infoText = clinicInfo ? `${clinicInfo}\n\n` : 'Θα επικοινωνήσει μαζί σας το ιατρείο για να απαντήσει στην ερώτησή σας 👍\n\n';
        sendReply(clinic, normalizedFromPhone, `${infoText}Θέλετε να σας κλείσω και ένα ραντεβού;\n1️⃣ Ναι  2️⃣ Όχι`);
        return;
    }

    if (state === 'CALLBACK') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'COMPLETED', status: 'RECOVERING' }
        });
        sendReply(clinic, normalizedFromPhone, 'Το ιατρείο θα σας καλέσει σύντομα 📞');
        return;
    }

    const intent = detectIntent(text);
    console.log(`[Conversation] intent=${intent} for ${normalizedFromPhone} (case=${mc.id})`);

    if (intent === 'BOOKING') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'BOOKING', bookingStep: 'ASKED_NAME', status: 'RECOVERING' }
        });
        sendReply(clinic, normalizedFromPhone, 'Τέλεια! 😊 Πώς σας λένε;');
        return;
    }

    if (intent === 'QUESTION') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'QUESTION', status: 'RECOVERING' }
        });
        const clinicInfo = buildClinicInfo(clinic);
        const infoText = clinicInfo ? `${clinicInfo}\n\n` : 'Θα επικοινωνήσει μαζί σας το ιατρείο 👍\n\n';
        sendReply(clinic, normalizedFromPhone, `${infoText}Θέλετε να σας κλείσω και ένα ραντεβού;\n1️⃣ Ναι  2️⃣ Όχι`);
        return;
    }

    if (intent === 'CALLBACK') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'CALLBACK', status: 'RECOVERING' }
        });
        sendReply(clinic, normalizedFromPhone, getTemplate(clinic, 'smsCallbackConfirm', 'Εντάξει! Θα σας καλέσουμε σύντομα 📞 Ευχαριστούμε!'));
        return;
    }

    sendReply(clinic, normalizedFromPhone, getTemplate(clinic, 'smsUnknown', 'Απαντήστε 1, 2 ή 3 για να σας βοηθήσω 👍\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση'));
}

async function handleBookingStep(mc, clinic, text, fromPhone) {
    const step = mc.bookingStep;
    console.log(`[Conversation] booking step=${step} for ${fromPhone}`);

    if (step === 'ASKED_NAME') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { bookingName: text, bookingStep: 'ASKED_DAY' }
        });
        sendReply(clinic, fromPhone, `Χαρά μου, ${text}! 📅 Ποια μέρα σας βολεύει;`);
        return;
    }

    if (step === 'ASKED_DAY') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { bookingDay: text, bookingStep: 'ASKED_TIME' }
        });
        sendReply(clinic, fromPhone, 'Ωραία! ⏰ Τι ώρα σας βολεύει;');
        return;
    }

    if (step !== 'ASKED_TIME') {
        sendReply(clinic, fromPhone, 'Το ραντεβού σας έχει καταχωρηθεί. Θα επικοινωνήσουμε σύντομα 😊');
        return;
    }

    const day = mc.bookingDay || '';
    const time = text;
    const startTime = parseAppointmentDay(day);
    if (!startTime) {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { bookingStep: 'ASKED_DAY' }
        });
        sendReply(clinic, fromPhone, 'Δεν κατάλαβα την ημέρα. Στείλτε π.χ. σήμερα, αύριο, Δευτέρα ή Παρασκευή.');
        return;
    }

    const parsedTime = parseAppointmentTime(time);
    if (!parsedTime) {
        sendReply(clinic, fromPhone, 'Δεν κατάλαβα την ώρα. Στείλτε π.χ. 10:00 ή 17:30.');
        return;
    }
    startTime.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const patientName = mc.bookingName || mc.patient?.name || fromPhone;
    let patient;
    try {
        patient = await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinic.id, phone: fromPhone } },
            update: mc.bookingName ? { name: mc.bookingName } : {},
            create: { clinicId: clinic.id, name: patientName, phone: fromPhone },
        });
    } catch (err) {
        console.warn(`[Conversation] patient upsert failed: ${err.message}`);
        await prisma.missedCall.update({ where: { id: mc.id }, data: { bookingStep: 'ASKED_NAME' } });
        sendReply(clinic, fromPhone, 'Δεν μπόρεσα να αποθηκεύσω τα στοιχεία σας. Μπορείτε να μου στείλετε ξανά το όνομά σας;');
        return;
    }

    try {
        await createAppointment({
            clinicId: clinic.id,
            patientId: patient.id,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            reason: 'Ραντεβού από SMS ανάκτησης'
        }, SYSTEM_ACTOR);
    } catch (err) {
        console.warn(`[Conversation] appointment create failed: ${err.message}`);
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { bookingStep: 'ASKED_DAY', status: 'RECOVERING' }
        });
        sendReply(clinic, fromPhone, 'Δεν μπόρεσα να κλείσω αυτό το ραντεβού. Η ώρα ίσως δεν είναι διαθέσιμη. Στείλτε άλλη ημέρα ή ώρα.');
        return;
    }

    const bookingMsg = getTemplate(clinic, 'smsBookingConfirm', 'Τέλεια 👍 Σας κλείσαμε για {day} στις {time}.\nΑν χρειαστείτε κάτι άλλο, απαντήστε εδώ 😊')
        .replace('{day}', day)
        .replace('{time}', time);
    sendReply(clinic, fromPhone, bookingMsg);

    await prisma.missedCall.update({
        where: { id: mc.id },
        data: {
            conversationState: 'COMPLETED',
            bookingStep: 'CONFIRMING',
            status: 'RECOVERED',
            recoveredAt: new Date(),
            patientId: patient.id,
        }
    });
    console.log(`[Conversation] BOOKING completed for ${fromPhone} - day=${day} time=${time}`);
}

module.exports = {
    handleInboundReply,
    parseAppointmentDay,
};
