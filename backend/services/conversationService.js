/**
 * Smart SMS conversation state machine.
 * All outbound SMS go through n8n webhook (sendReply).
 * States: NEW → BOOKING / QUESTION / CALLBACK → COMPLETED
 */
const prisma = require('./prisma');
const { detectIntent } = require('./intentService');
const https = require('https');
const http = require('http');

// ── Send reply via n8n direct SMS webhook ────────────────────────────────────
function sendReply(clinic, phone, message) {
    const webhookUrl = clinic.webhookDirectSms || clinic.webhookReminders || clinic.webhookUrl;
    if (!webhookUrl) {
        console.warn(`[Conversation] No webhook URL for clinic ${clinic.id} — reply not sent to ${phone}`);
        return;
    }

    const body = JSON.stringify({ phone, message, clinicId: clinic.id });
    const secret = process.env.WEBHOOK_SECRET || '';

    try {
        const parsed = new URL(webhookUrl);
        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.request({
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'x-webhook-key': secret,
            },
        }, (res) => { res.resume(); });
        req.on('error', (err) => console.warn(`[Conversation] reply failed for ${phone}: ${err.message}`));
        req.setTimeout(8000, () => { req.destroy(); });
        req.write(body);
        req.end();
    } catch (err) {
        console.warn(`[Conversation] sendReply error for ${phone}: ${err.message}`);
    }
}

// ── Main handler ─────────────────────────────────────────────────────────────
async function handleInboundReply({ clinicId, fromPhone, messageBody, missedCallId }) {
    if (!missedCallId) return;

    const mc = await prisma.missedCall.findUnique({
        where: { id: missedCallId },
        include: { clinic: true }
    });
    if (!mc || mc.clinicId !== clinicId) return;

    const clinic = mc.clinic;
    const state = mc.conversationState || 'NEW';
    const text = (messageBody || '').trim();

    console.log(`[Conversation] case=${mc.id} state=${state} from=${fromPhone} msg="${text.slice(0, 50)}"`);

    // ── BOOKING flow ─────────────────────────────────────────────────────────
    if (state === 'BOOKING') {
        return handleBookingStep(mc, clinic, text, fromPhone);
    }

    // ── QUESTION flow ────────────────────────────────────────────────────────
    if (state === 'QUESTION') {
        const clinicInfo = buildClinicInfo(clinic);
        const infoText = clinicInfo
            ? `${clinicInfo}\n\n`
            : `Θα επικοινωνήσει μαζί σας το ιατρείο για να απαντήσει στην ερώτησή σας 👍\n\n`;
        // Soft conversion nudge after answering
        const reply = `${infoText}Θέλετε να σας κλείσω και ένα ραντεβού; 😊\n1️⃣ Ναι  2️⃣ Όχι ευχαριστώ`;
        sendReply(clinic, fromPhone, reply);
        console.log(`[Conversation] QUESTION answered + nudge sent to ${fromPhone}`);
        return;
    }

    // ── CALLBACK flow ────────────────────────────────────────────────────────
    if (state === 'CALLBACK') {
        sendReply(clinic, fromPhone, `Το ιατρείο θα σας καλέσει σύντομα 📞`);
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'COMPLETED', status: 'RECOVERING' }
        });
        console.log(`[Conversation] CALLBACK confirmed for ${fromPhone}`);
        return;
    }

    // ── NEW / COMPLETED — detect intent ──────────────────────────────────────
    const intent = detectIntent(text);
    console.log(`[Conversation] intent=${intent} for ${fromPhone} (case=${mc.id})`);

    if (intent === 'BOOKING') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'BOOKING', bookingStep: 'ASKED_DAY', status: 'RECOVERING' }
        });
        sendReply(clinic, fromPhone, `Τέλεια! 📅 Ποια μέρα σας βολεύει;`);
        return;
    }

    if (intent === 'QUESTION') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'QUESTION', status: 'RECOVERING' }
        });
        const clinicInfo = buildClinicInfo(clinic);
        const infoText = clinicInfo
            ? `${clinicInfo}\n\n`
            : `Θα επικοινωνήσει μαζί σας το ιατρείο 👍\n\n`;
        const reply = `${infoText}Θέλετε να σας κλείσω και ένα ραντεβού; 😊\n1️⃣ Ναι  2️⃣ Όχι ευχαριστώ`;
        sendReply(clinic, fromPhone, reply);
        return;
    }

    if (intent === 'CALLBACK') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { conversationState: 'CALLBACK', status: 'RECOVERING' }
        });
        // Log callback request clearly for clinic visibility
        console.log(`[Conversation] CALLBACK_REQUESTED clinic=${clinicId} phone=${fromPhone} case=${mc.id}`);
        sendReply(clinic, fromPhone, `Εντάξει! Θα σας καλέσουμε σύντομα 📞 Ευχαριστούμε!`);
        return;
    }

    // UNKNOWN — guide back to menu
    sendReply(clinic, fromPhone, `Απαντήστε 1, 2 ή 3 για να σας βοηθήσω 👍\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση`);
    console.log(`[Conversation] UNKNOWN intent for ${fromPhone} — menu resent`);
}

// ── Booking step machine ──────────────────────────────────────────────────────
async function handleBookingStep(mc, clinic, text, fromPhone) {
    const step = mc.bookingStep;
    console.log(`[Conversation] booking step=${step} for ${fromPhone}`);

    if (step === 'ASKED_DAY') {
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { bookingDay: text, bookingStep: 'ASKED_TIME' }
        });
        sendReply(clinic, fromPhone, `Ωραία! ⏰ Τι ώρα σας βολεύει;`);
        return;
    }

    if (step === 'ASKED_TIME') {
        const day = mc.bookingDay || 'την ημέρα που ζητήσατε';
        const time = text;
        // Human-feeling confirmation
        sendReply(clinic, fromPhone, `Τέλεια 👍 Σας κλείσαμε για ${day} στις ${time}.\nΑν χρειαστείτε κάτι άλλο, απαντήστε εδώ 😊`);
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: {
                conversationState: 'COMPLETED',
                bookingStep: 'CONFIRMING',
                status: 'RECOVERED',
                recoveredAt: new Date(),
            }
        });
        console.log(`[Conversation] BOOKING completed for ${fromPhone} — day=${day} time=${time}`);
        return;
    }

    // Already confirmed
    sendReply(clinic, fromPhone, `Το ραντεβού σας έχει καταχωρηθεί. Θα επικοινωνήσουμε σύντομα 😊`);
}

// ── Build clinic info for QUESTION replies ────────────────────────────────────
function buildClinicInfo(clinic) {
    try {
        const ai = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {});
        const parts = [];
        if (ai.services) parts.push(`Υπηρεσίες: ${ai.services}`);
        if (ai.workingHours) parts.push(`Ώρες: ${ai.workingHours}`);
        if (clinic.location) parts.push(`Διεύθυνση: ${clinic.location}`);
        return parts.length > 0 ? parts.join('\n') : null;
    } catch {
        return null;
    }
}

module.exports = { handleInboundReply };
