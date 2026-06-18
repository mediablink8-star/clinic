const prisma = require('../prisma');

async function findByCallSid(callSid, clinicId) {
    if (!callSid) return null;
    return prisma.missedCall.findFirst({ where: { callSid, clinicId } });
}

async function createMissedCall({ phone, clinicId, callSid, estimatedRevenue, patientId, withinHours, scheduledAt }) {
    const upsertKey = callSid || `nocalldup:${clinicId}:${phone}:${Date.now()}`;

    return prisma.missedCall.upsert({
        where: { callSid: upsertKey },
        update: {
            status: 'RECOVERING',
            smsStatus: withinHours ? 'pending' : 'scheduled',
            scheduledSmsAt: withinHours ? null : scheduledAt,
            patientId,
        },
        create: {
            clinicId,
            fromNumber: phone,
            callSid: callSid || null,
            status: 'RECOVERING',
            smsStatus: withinHours ? 'pending' : 'scheduled',
            scheduledSmsAt: withinHours ? null : scheduledAt,
            estimatedRevenue,
            patientId,
        },
    });
}

async function updateMissedCallStatus(id, smsStatus, callSid) {
    return prisma.missedCall.update({
        where: { id },
        data: {
            smsStatus,
            ...(callSid && { callSid }),
        },
    });
}

async function updateMissedCall(id, data) {
    return prisma.missedCall.update({ where: { id }, data });
}

module.exports = {
    findByCallSid,
    createMissedCall,
    updateMissedCallStatus,
    updateMissedCall,
};
