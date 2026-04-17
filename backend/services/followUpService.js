/**
 * Follow-up cron processor.
 * Called every 5 minutes by workflow 4 via /api/automation/process-missed-calls
 * (or can be called directly from the internal cron).
 *
 * Rules:
 * - Follow-up 1: sent 8 minutes after initial SMS if no reply
 * - Follow-up 2: sent 90 minutes after initial SMS if still no reply
 * - Max 2 follow-ups total
 * - Stop if conversationState changed from NEW (patient engaged)
 */
const prisma = require('./prisma');
const https = require('https');
const http = require('http');

const FOLLOWUP_1_DELAY_MS = 8 * 60 * 1000;       // 8 minutes
const FOLLOWUP_2_DELAY_MS = 90 * 60 * 1000;      // 90 minutes

function sendFollowUp(clinic, phone, message) {
    const webhookUrl = clinic.webhookDirectSms || clinic.webhookReminders || clinic.webhookUrl;
    if (!webhookUrl) return;

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
        req.on('error', (err) => console.warn(`[FollowUp] send failed: ${err.message}`));
        req.setTimeout(8000, () => req.destroy());
        req.write(body);
        req.end();
    } catch (err) {
        console.warn(`[FollowUp] error: ${err.message}`);
    }
}

async function processFollowUps() {
    const now = new Date();
    const followUp1Threshold = new Date(now - FOLLOWUP_1_DELAY_MS);
    const followUp2Threshold = new Date(now - FOLLOWUP_2_DELAY_MS);

    // Find cases eligible for follow-up 1
    const needFollowUp1 = await prisma.missedCall.findMany({
        where: {
            conversationState: 'NEW',
            smsStatus: 'sent',
            lastSmsSentAt: { lte: followUp1Threshold },
            followUp1SentAt: null,
            status: { in: ['DETECTED', 'RECOVERING'] },
        },
        include: { clinic: true },
        take: 50,
    });

    for (const mc of needFollowUp1) {
        if (!mc.clinic) continue;
        const msg = `Μόλις ελέγχαμε — χρειάζεστε βοήθεια με ραντεβού ή έχετε ερώτηση; 😊\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση`;
        sendFollowUp(mc.clinic, mc.fromNumber, msg);
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { followUp1SentAt: now }
        });
        console.log(`[FollowUp1] Sent to ${mc.fromNumber} for case ${mc.id}`);
    }

    // Find cases eligible for follow-up 2
    const needFollowUp2 = await prisma.missedCall.findMany({
        where: {
            conversationState: 'NEW',
            smsStatus: 'sent',
            lastSmsSentAt: { lte: followUp2Threshold },
            followUp1SentAt: { not: null },
            followUp2SentAt: null,
            status: { in: ['DETECTED', 'RECOVERING'] },
        },
        include: { clinic: true },
        take: 50,
    });

    for (const mc of needFollowUp2) {
        if (!mc.clinic) continue;
        const msg = `Έχουμε περιορισμένη διαθεσιμότητα σήμερα — θέλετε να κλείσουμε κάτι για εσάς; 📅`;
        sendFollowUp(mc.clinic, mc.fromNumber, msg);
        await prisma.missedCall.update({
            where: { id: mc.id },
            data: { followUp2SentAt: now }
        });
        console.log(`[FollowUp2] Sent to ${mc.fromNumber} for case ${mc.id}`);
    }

    return { followUp1: needFollowUp1.length, followUp2: needFollowUp2.length };
}

module.exports = { processFollowUps };
