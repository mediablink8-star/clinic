const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/', asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const clinicId = req.clinicId;

    const [activityEvents, missedCalls, feedEvents] = await Promise.all([
        prisma.activityEvent.findMany({
            where: { clinicId, type: { in: ['PATIENT_REPLIED', 'INBOUND_SMS_RECEIVED', 'CASE_RECOVERED', 'CASE_CLOSED', 'MISSED_CALL_DETECTED'] } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { recoveryCase: { include: { missedCall: { include: { patient: true } } } } }
        }),
        prisma.missedCall.findMany({
            where: { clinicId, status: { not: 'RECOVERED' } },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { patient: true }
        }),
        prisma.feedEvent.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
            take: limit
        })
    ]);

    const mapped = [];

    for (const ev of activityEvents) {
        const patientName = ev.recoveryCase?.missedCall?.patient?.name || ev.recoveryCase?.missedCall?.patientName || null;
        const phone = ev.recoveryCase?.missedCall?.fromNumber || null;
            mapped.push({
                id: 'ae_' + ev.id,
                type: ev.type,
                title: getEventTitle(ev.type),
                patientName,
                phone,
                createdAt: ev.createdAt.toISOString(),
                missedCallId: ev.recoveryCase?.missedCall?.id || null,
                patientId: ev.recoveryCase?.missedCall?.patientId || null,
                appointmentId: ev.recoveryCase?.missedCall?.appointmentId || null,
            });
    }

    for (const mc of missedCalls) {
        if (mc.status !== 'DETECTED') continue;
        mapped.push({
            id: 'mc_' + mc.id,
            type: 'MISSED_CALL_DETECTED',
            title: 'Αναπάντητη κλήση',
            patientName: mc.patient?.name || mc.patientName || null,
            phone: mc.fromNumber || null,
            createdAt: mc.createdAt.toISOString(),
            missedCallId: mc.id,
            patientId: mc.patientId || null,
            appointmentId: mc.appointmentId || null,
        });
    }

    for (const fe of feedEvents) {
        mapped.push({
            id: 'fe_' + fe.id,
            type: fe.type,
            title: fe.title || getEventTitle(fe.type),
            patientName: fe.patientName || null,
            phone: fe.phone || null,
            createdAt: fe.createdAt.toISOString(),
            appointmentId: fe.appointmentId || null,
            missedCallId: null,
            patientId: null,
            estimatedRevenue: (fe.metadata && typeof fe.metadata === 'object' && fe.metadata.estimatedRevenue) || null,
        });
    }

    mapped.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(mapped.slice(0, limit));
}));

function getEventTitle(type) {
    const titles = {
        MISSED_CALL_DETECTED: 'Αναπάντητη κλήση',
        PATIENT_REPLIED: 'Ασθενής απάντησε',
        INBOUND_SMS_RECEIVED: 'Μήνυμα ασθενούς',
        CASE_RECOVERED: 'Ανάκτηση κλήσης',
        CASE_CLOSED: 'Υπόθεση έκλεισε',
        APPOINTMENT_BOOKED_VIA_LINK: 'Ραντεβού από δημόσιο σύνδεσμο',
        APPOINTMENT_BOOKED_VIA_SMS: 'Ραντεβού από SMS',
        APPOINTMENT_BOOKED_VIA_CALL: 'Ραντεβού από κλήση',
        AI_CALL_ANSWERED: 'AI κλήση απαντήθηκε'
    };
    return titles[type] || type;
}

module.exports = router;
