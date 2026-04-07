const prisma = require('./prisma');
const AppError = require('../errors/AppError');

const ACTIVE_RECOVERY_CASE_STATES = ['ACTIVE', 'ENGAGED'];

function mapMissedCallStatusToRecoveryCaseState(status) {
    switch (status) {
        case 'RECOVERED':
            return 'RECOVERED';
        case 'LOST':
            return 'CLOSED_NO_RESPONSE';
        case 'DETECTED':
        case 'RECOVERING':
        default:
            return 'ACTIVE';
    }
}

function normalizeTwilioMessageStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();

    if (!normalized) return null;
    if (['queued', 'accepted', 'scheduled', 'sending'].includes(normalized)) return 'QUEUED';
    if (['sent'].includes(normalized)) return 'SENT';
    if (['delivered', 'read'].includes(normalized)) return 'DELIVERED';
    if (['failed', 'undelivered', 'canceled'].includes(normalized)) return 'FAILED';
    if (['received', 'receiving'].includes(normalized)) return 'RECEIVED';

    return null;
}

function shouldAdvanceMessageStatus(currentStatus, nextStatus) {
    if (!nextStatus) return false;
    if (!currentStatus) return true;
    if (currentStatus === nextStatus) return false;

    if (currentStatus === 'DELIVERED' || currentStatus === 'RECEIVED' || currentStatus === 'FAILED') {
        return false;
    }

    if (currentStatus === 'QUEUED') {
        return ['SENT', 'DELIVERED', 'FAILED'].includes(nextStatus);
    }

    if (currentStatus === 'SENT') {
        return ['DELIVERED', 'FAILED'].includes(nextStatus);
    }

    return false;
}

function getMessageTimestampFields(status, occurredAt = new Date()) {
    switch (status) {
        case 'QUEUED':
            return { queuedAt: occurredAt };
        case 'SENT':
            return { sentAt: occurredAt };
        case 'DELIVERED':
            return { deliveredAt: occurredAt };
        case 'FAILED':
            return { failedAt: occurredAt };
        case 'RECEIVED':
            return { receivedAt: occurredAt };
        default:
            return {};
    }
}

function getActivityTypeForMessageStatus(status, direction) {
    if (direction === 'INBOUND') {
        return status === 'RECEIVED' ? 'INBOUND_SMS_RECEIVED' : null;
    }

    switch (status) {
        case 'QUEUED':
            return 'OUTBOUND_SMS_QUEUED';
        case 'SENT':
            return 'OUTBOUND_SMS_SENT';
        case 'DELIVERED':
            return 'OUTBOUND_SMS_DELIVERED';
        case 'FAILED':
            return 'OUTBOUND_SMS_FAILED';
        default:
            return null;
    }
}

function mapMessageStatusToLegacySmsStatus(status) {
    if (status === 'FAILED') return 'failed';
    if (['QUEUED', 'SENT', 'DELIVERED'].includes(status)) return 'sent';
    return null;
}

async function appendActivityEvent({
    clinicId,
    recoveryCaseId,
    conversationId = null,
    messageId = null,
    type,
    metadata = null,
}) {
    return prisma.activityEvent.create({
        data: {
            clinicId,
            recoveryCaseId,
            conversationId,
            messageId,
            type,
            metadata: metadata || undefined,
        }
    });
}

async function ensureRecoveryCaseForMissedCall(missedCallId) {
    const existing = await prisma.recoveryCase.findUnique({
        where: { missedCallId },
        include: { conversation: true }
    });

    if (existing?.conversation) return existing;

    const missedCall = await prisma.missedCall.findUnique({
        where: { id: missedCallId },
        include: { clinic: true }
    });

    if (!missedCall) {
        throw new AppError('NOT_FOUND', 'MissedCall not found', 404);
    }

    if (existing) {
        const conversation = await prisma.conversation.create({
            data: {
                clinicId: missedCall.clinicId,
                recoveryCaseId: existing.id,
                patientPhone: missedCall.fromNumber,
                clinicPhone: missedCall.clinic?.phone || null,
            }
        });

        return { ...existing, conversation };
    }

    try {
        return await prisma.$transaction(async (tx) => {
            const recoveryCase = await tx.recoveryCase.create({
                data: {
                    clinicId: missedCall.clinicId,
                    patientId: missedCall.patientId || null,
                    missedCallId: missedCall.id,
                    patientPhone: missedCall.fromNumber,
                    state: mapMissedCallStatusToRecoveryCaseState(missedCall.status),
                    recoveredAt: missedCall.recoveredAt || null,
                    lastActivityAt: missedCall.updatedAt || missedCall.createdAt,
                }
            });

            const conversation = await tx.conversation.create({
                data: {
                    clinicId: missedCall.clinicId,
                    recoveryCaseId: recoveryCase.id,
                    patientPhone: missedCall.fromNumber,
                    clinicPhone: missedCall.clinic?.phone || null,
                    lastMessageAt: missedCall.lastSmsSentAt || null,
                }
            });

            await tx.activityEvent.create({
                data: {
                    clinicId: missedCall.clinicId,
                    recoveryCaseId: recoveryCase.id,
                    conversationId: conversation.id,
                    type: 'MISSED_CALL_DETECTED',
                    metadata: {
                        missedCallId: missedCall.id,
                        callSid: missedCall.callSid || null,
                        smsStatus: missedCall.smsStatus,
                    }
                }
            });

            return { ...recoveryCase, conversation };
        });
    } catch (error) {
        if (error.code === 'P2002') {
            return prisma.recoveryCase.findUnique({
                where: { missedCallId },
                include: { conversation: true }
            });
        }

        throw error;
    }
}

async function recordOutboundMessageForMissedCall({
    missedCallId,
    status,
    providerMessageSid = null,
    providerStatusRaw = null,
    body = null,
    fromPhone = null,
    toPhone = null,
    errorCode = null,
    errorMessage = null,
    occurredAt = new Date(),
}) {
    const recoveryCase = await ensureRecoveryCaseForMissedCall(missedCallId);
    const activityType = getActivityTypeForMessageStatus(status, 'OUTBOUND');

    const message = await prisma.message.create({
        data: {
            clinicId: recoveryCase.clinicId,
            conversationId: recoveryCase.conversation.id,
            direction: 'OUTBOUND',
            status,
            body,
            fromPhone,
            toPhone: toPhone || recoveryCase.patientPhone,
            providerMessageSid,
            providerStatusRaw,
            errorCode,
            errorMessage,
            ...getMessageTimestampFields(status, occurredAt),
        }
    });

    await prisma.$transaction([
        prisma.conversation.update({
            where: { id: recoveryCase.conversation.id },
            data: { lastMessageAt: occurredAt }
        }),
        prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { lastActivityAt: occurredAt }
        }),
    ]);

    if (activityType) {
        await appendActivityEvent({
            clinicId: recoveryCase.clinicId,
            recoveryCaseId: recoveryCase.id,
            conversationId: recoveryCase.conversation.id,
            messageId: message.id,
            type: activityType,
            metadata: {
                missedCallId,
                providerMessageSid,
                providerStatusRaw,
                errorCode,
                errorMessage,
            }
        });
    }

    return { recoveryCase, message };
}

async function resolveRecoveryContext({ providerMessageSid, recoveryCaseId, missedCallId, clinicId, patientPhone }) {
    if (providerMessageSid) {
        const existingMessage = await prisma.message.findUnique({
            where: { providerMessageSid },
            include: {
                conversation: {
                    include: { recoveryCase: true }
                }
            }
        });

        if (existingMessage) {
            return {
                recoveryCase: existingMessage.conversation.recoveryCase,
                conversation: existingMessage.conversation,
                message: existingMessage,
            };
        }
    }

    if (recoveryCaseId) {
        const recoveryCase = await prisma.recoveryCase.findUnique({
            where: { id: recoveryCaseId },
            include: { conversation: true }
        });

        if (recoveryCase?.conversation) {
            return { recoveryCase, conversation: recoveryCase.conversation, message: null };
        }
    }

    if (missedCallId) {
        const recoveryCase = await ensureRecoveryCaseForMissedCall(missedCallId);
        return { recoveryCase, conversation: recoveryCase.conversation, message: null };
    }

    if (clinicId && patientPhone) {
        const recoveryCase = await prisma.recoveryCase.findFirst({
            where: {
                clinicId,
                patientPhone,
                state: { in: ACTIVE_RECOVERY_CASE_STATES }
            },
            include: { conversation: true },
            orderBy: { lastActivityAt: 'desc' }
        });

        if (recoveryCase?.conversation) {
            return { recoveryCase, conversation: recoveryCase.conversation, message: null };
        }
    }

    return null;
}

async function recordInboundMessage({
    clinicId,
    fromPhone,
    body,
    providerMessageSid = null,
    providerStatusRaw = null,
    missedCallId = null,
    recoveryCaseId = null,
    occurredAt = new Date(),
}) {
    const recoveryContext = await resolveRecoveryContext({
        clinicId,
        patientPhone: fromPhone,
        missedCallId,
        recoveryCaseId,
    });

    if (!recoveryContext) {
        return { success: false, reason: 'No matching recovery case' };
    }

    if (providerMessageSid) {
        const existingMessage = await prisma.message.findUnique({ where: { providerMessageSid } });
        if (existingMessage) {
            return { success: true, duplicate: true, messageId: existingMessage.id };
        }
    }

    const { recoveryCase, conversation } = recoveryContext;
    const message = await prisma.message.create({
        data: {
            clinicId,
            conversationId: conversation.id,
            direction: 'INBOUND',
            status: 'RECEIVED',
            body,
            fromPhone,
            toPhone: conversation.clinicPhone || null,
            providerMessageSid,
            providerStatusRaw,
            ...getMessageTimestampFields('RECEIVED', occurredAt),
        }
    });

    await prisma.$transaction([
        prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: occurredAt }
        }),
        prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: {
                lastActivityAt: occurredAt,
                state: recoveryCase.state === 'ACTIVE' ? 'ENGAGED' : recoveryCase.state,
            }
        }),
    ]);

    await appendActivityEvent({
        clinicId,
        recoveryCaseId: recoveryCase.id,
        conversationId: conversation.id,
        messageId: message.id,
        type: 'INBOUND_SMS_RECEIVED',
        metadata: {
            providerMessageSid,
            providerStatusRaw,
        }
    });

    await appendActivityEvent({
        clinicId,
        recoveryCaseId: recoveryCase.id,
        conversationId: conversation.id,
        messageId: message.id,
        type: 'PATIENT_REPLIED',
        metadata: {
            bodyPreview: body ? body.slice(0, 140) : null,
        }
    });

    return { success: true, messageId: message.id, recoveryCaseId: recoveryCase.id };
}

async function syncLegacyMissedCallSmsStatus(missedCallId, status, errorMessage = null, occurredAt = new Date()) {
    const legacySmsStatus = mapMessageStatusToLegacySmsStatus(status);
    if (!legacySmsStatus) return;

    await prisma.missedCall.update({
        where: { id: missedCallId },
        data: status === 'FAILED'
            ? { smsStatus: 'failed', smsError: errorMessage || 'SMS delivery failed' }
            : { smsStatus: legacySmsStatus, lastSmsSentAt: occurredAt, smsError: null }
    });
}

async function handleTwilioStatusCallback({
    providerMessageSid,
    providerStatusRaw,
    clinicId = null,
    missedCallId = null,
    recoveryCaseId = null,
    errorCode = null,
    errorMessage = null,
    toPhone = null,
    fromPhone = null,
    occurredAt = new Date(),
}) {
    const nextStatus = normalizeTwilioMessageStatus(providerStatusRaw);
    if (!providerMessageSid || !nextStatus) {
        return { success: true, updated: false, reason: 'Unsupported or incomplete callback payload' };
    }

    const patientPhone = toPhone || fromPhone || null;
    const recoveryContext = await resolveRecoveryContext({
        providerMessageSid,
        recoveryCaseId,
        missedCallId,
        clinicId,
        patientPhone,
    });

    if (!recoveryContext) {
        return { success: true, updated: false, reason: 'No matching recovery context' };
    }

    const { recoveryCase, conversation } = recoveryContext;
    let message = recoveryContext.message;

    if (!message) {
        message = await prisma.message.findFirst({
            where: {
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                providerMessageSid: null,
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    let shouldCreateActivity = false;

    if (!message) {
        message = await prisma.message.create({
            data: {
                clinicId: recoveryCase.clinicId,
                conversationId: conversation.id,
                direction: 'OUTBOUND',
                status: nextStatus,
                body: null,
                fromPhone,
                toPhone,
                providerMessageSid,
                providerStatusRaw,
                errorCode,
                errorMessage,
                ...getMessageTimestampFields(nextStatus, occurredAt),
            }
        });
        shouldCreateActivity = true;
    } else {
        const updateData = {
            providerStatusRaw,
            errorCode,
            errorMessage,
        };

        if (!message.providerMessageSid) {
            updateData.providerMessageSid = providerMessageSid;
        }

        if (shouldAdvanceMessageStatus(message.status, nextStatus)) {
            updateData.status = nextStatus;
            Object.assign(updateData, getMessageTimestampFields(nextStatus, occurredAt));
            shouldCreateActivity = true;
        }

        message = await prisma.message.update({
            where: { id: message.id },
            data: updateData
        });
    }

    const activityType = getActivityTypeForMessageStatus(nextStatus, message.direction);

    await prisma.$transaction([
        prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: occurredAt }
        }),
        prisma.recoveryCase.update({
            where: { id: recoveryCase.id },
            data: { lastActivityAt: occurredAt }
        }),
    ]);

    if (shouldCreateActivity && activityType) {
        await appendActivityEvent({
            clinicId: recoveryCase.clinicId,
            recoveryCaseId: recoveryCase.id,
            conversationId: conversation.id,
            messageId: message.id,
            type: activityType,
            metadata: {
                providerMessageSid,
                providerStatusRaw,
                errorCode,
                errorMessage,
            }
        });
    }

    if (recoveryCase.missedCallId) {
        await syncLegacyMissedCallSmsStatus(recoveryCase.missedCallId, nextStatus, errorMessage, occurredAt);
    }

    return {
        success: true,
        updated: true,
        messageId: message.id,
        recoveryCaseId: recoveryCase.id,
        status: message.status,
    };
}

async function markRecoveryCaseRecovered({ clinicId, missedCallId, occurredAt = new Date() }) {
    const recoveryCase = await prisma.recoveryCase.findUnique({
        where: { missedCallId },
        include: { conversation: true }
    });

    if (!recoveryCase || recoveryCase.clinicId !== clinicId) {
        return null;
    }

    if (recoveryCase.state === 'RECOVERED') {
        return recoveryCase;
    }

    const updated = await prisma.recoveryCase.update({
        where: { id: recoveryCase.id },
        data: {
            state: 'RECOVERED',
            recoveredAt: occurredAt,
            lastActivityAt: occurredAt,
        },
        include: { conversation: true }
    });

    await appendActivityEvent({
        clinicId,
        recoveryCaseId: updated.id,
        conversationId: updated.conversation?.id || null,
        type: 'CASE_RECOVERED',
        metadata: { missedCallId }
    });

    return updated;
}

async function backfillRecoveryCases({ days = 30 } = {}) {
    const threshold = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const missedCalls = await prisma.missedCall.findMany({
        where: {
            OR: [
                { status: { in: ['DETECTED', 'RECOVERING'] } },
                { createdAt: { gte: threshold } },
            ]
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
    });

    let processed = 0;
    for (const missedCall of missedCalls) {
        await ensureRecoveryCaseForMissedCall(missedCall.id);
        processed += 1;
    }

    return { processed };
}

module.exports = {
    ACTIVE_RECOVERY_CASE_STATES,
    mapMissedCallStatusToRecoveryCaseState,
    normalizeTwilioMessageStatus,
    shouldAdvanceMessageStatus,
    ensureRecoveryCaseForMissedCall,
    recordOutboundMessageForMissedCall,
    recordInboundMessage,
    handleTwilioStatusCallback,
    markRecoveryCaseRecovered,
    backfillRecoveryCases,
};
