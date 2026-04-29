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
const { sendManagedSms } = require('./messagingService');

const FOLLOWUP_1_DELAY_MS = 8 * 60 * 1000;
const FOLLOWUP_2_DELAY_MS = 90 * 60 * 1000;

async function processFollowUps() {
    const now = new Date();
    const followUp1Threshold = new Date(now - FOLLOWUP_1_DELAY_MS);
    const followUp2Threshold = new Date(now - FOLLOWUP_2_DELAY_MS);

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

    let followUp1Count = 0;
    for (const mc of needFollowUp1) {
        if (!mc.clinic) continue;
        try {
            const msg = `Μόλις ελέγχαμε — χρειάζεστε βοήθεια με ραντεβού ή έχετε ερώτηση; 😊\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση`;
            await sendManagedSms({
                clinicId: mc.clinic.id,
                clinic: mc.clinic,
                eventType: 'sms.followup',
                payload: { phone: mc.fromNumber, message: msg, missedCallId: mc.id, clinicId: mc.clinic.id },
                logType: 'FOLLOW_UP',
            });
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { followUp1SentAt: now }
            });
            followUp1Count++;
            console.log(`[FollowUp1] Sent to ${mc.fromNumber} for case ${mc.id}`);
        } catch (err) {
            console.error(`[FollowUp1] Failed for case ${mc.id}: ${err.message}`);
        }
    }

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

    let followUp2Count = 0;
    for (const mc of needFollowUp2) {
        if (!mc.clinic) continue;
        try {
            const msg = `Έχουμε περιορισμένη διαθεσιμότητα σήμερα — θέλετε να κλείσουμε κάτι για εσάς; 📅`;
            await sendManagedSms({
                clinicId: mc.clinic.id,
                clinic: mc.clinic,
                eventType: 'sms.followup',
                payload: { phone: mc.fromNumber, message: msg, missedCallId: mc.id, clinicId: mc.clinic.id },
                logType: 'FOLLOW_UP',
            });
            await prisma.missedCall.update({
                where: { id: mc.id },
                data: { followUp2SentAt: now }
            });
            followUp2Count++;
            console.log(`[FollowUp2] Sent to ${mc.fromNumber} for case ${mc.id}`);
        } catch (err) {
            console.error(`[FollowUp2] Failed for case ${mc.id}: ${err.message}`);
        }
    }

    return { followUp1: followUp1Count, followUp2: followUp2Count };
}

module.exports = { processFollowUps };
