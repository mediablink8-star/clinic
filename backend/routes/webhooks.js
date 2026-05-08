const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const AppError = require('../errors/AppError');
const prisma = require('../services/prisma');
const { handleMissedCall } = require('../services/missedCallService');
const { forwardInboundMessage } = require('../services/webhookService');
const { recordInboundMessage } = require('../services/recoveryTrackingService');
const { handleInboundReply } = require('../services/conversationService');
const { normalizePhone } = require('../utils/phone');

router.post('/missed-call', asyncHandler(async (req, res) => {
    const { phone = '+30690000000', clinicId, callSid } = req.body;
    const bypassCooldown = process.env.NODE_ENV !== 'production' && req.body.bypassCooldown === true;

    if (!clinicId) throw new AppError('VALIDATION_ERROR', 'clinicId is required', 400);

    const { data } = await handleMissedCall({ phone, clinicId, callSid, bypassCooldown });

    if (data.duplicate) {
        return res.json({ success: true, duplicate: true, missedCallId: data.missedCallId });
    }

    res.json({ success: true, ...data });
}));

router.post('/sms', asyncHandler(async (req, res) => {
    const {
        clinicId,
        from,
        body: messageBody,
        provider = 'sms',
        raw,
        missedCallId = null,
        recoveryCaseId = null,
        providerMessageSid = null,
        providerStatusRaw = null,
    } = req.body;

    if (!clinicId) throw new AppError('VALIDATION_ERROR', 'clinicId is required', 400);
    if (!from) throw new AppError('VALIDATION_ERROR', 'from is required', 400);
    if (!messageBody) throw new AppError('VALIDATION_ERROR', 'body is required', 400);

    const normalizedFrom = normalizePhone(from);
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new AppError('NOT_FOUND', 'Clinic not found', 404);

    await recordInboundMessage({
        clinicId,
        fromPhone: normalizedFrom,
        body: messageBody,
        providerMessageSid,
        providerStatusRaw: providerStatusRaw || provider,
        missedCallId,
        recoveryCaseId,
    }).catch((err) => {
        console.warn(`[SMS Inbound] Dual-write failed for clinicId=${clinicId}: ${err.message}`);
    });

    if (!clinic.webhookUrl) {
        console.info(`[SMS Inbound] clinicId=${clinicId} - no webhookUrl configured, skipping forward`);
        return res.json({ success: true, forwarded: false, reason: 'No webhook URL configured' });
    }

    const result = await forwardInboundMessage({
        from: normalizedFrom,
        body: messageBody,
        provider,
        clinic,
        raw,
    });

    res.json({ success: result.success, forwarded: result.success, ...(result.error ? { error: result.error } : {}) });
}));

router.post('/inbound-sms', asyncHandler(async (req, res) => {
    let {
        clinicId,
        from,
        to,
        body: messageBody,
        missedCallId = null,
        recoveryCaseId = null,
        providerMessageSid = null,
    } = req.body;

    if (!from) throw new AppError('VALIDATION_ERROR', 'from is required', 400);
    if (!messageBody) throw new AppError('VALIDATION_ERROR', 'body is required', 400);

    const normalizedFrom = normalizePhone(from);
    const normalizedTo = normalizePhone(to);

    if (!clinicId && normalizedTo) {
        const clinic = await prisma.clinic.findFirst({ where: { phone: normalizedTo } });
        if (clinic) clinicId = clinic.id;
    }

    if (!clinicId) throw new AppError('VALIDATION_ERROR', 'clinicId could not be resolved', 400);

    // Deduplicate BEFORE recording — check by providerMessageSid or body+phone within 30s
    if (providerMessageSid) {
        const existing = await prisma.message.findFirst({ where: { providerMessageSid, clinicId } });
        if (existing) {
            console.info(`[Inbound] Duplicate message ${providerMessageSid} skipped`);
            return res.json({ success: true, duplicate: true });
        }
    } else {
        const thirtySecondsAgo = new Date(Date.now() - 30000);
        const recentDupe = await prisma.message.findFirst({
            where: {
                clinicId,
                fromPhone: normalizedFrom,
                body: messageBody,
                direction: 'INBOUND',
                createdAt: { gte: thirtySecondsAgo },
            }
        });
        if (recentDupe) {
            console.info(`[Inbound] Duplicate body from ${normalizedFrom} within 30s skipped`);
            return res.json({ success: true, duplicate: true });
        }
    }

    if (!missedCallId) {
        const activeCase = await prisma.recoveryCase.findFirst({
            where: {
                clinicId,
                patientPhone: normalizedFrom,
                state: { in: ['ACTIVE', 'ENGAGED'] },
            },
            orderBy: { lastActivityAt: 'desc' },
            select: { missedCallId: true },
        });
        if (activeCase?.missedCallId) missedCallId = activeCase.missedCallId;
    }

    const result = await recordInboundMessage({
        clinicId,
        fromPhone: normalizedFrom,
        body: messageBody,
        providerMessageSid,
        providerStatusRaw: 'inbound',
        missedCallId,
        recoveryCaseId,
    });

    if (missedCallId) {
        handleInboundReply({ clinicId, fromPhone: normalizedFrom, messageBody, missedCallId })
            .catch(err => console.warn('[Conversation] handleInboundReply error:', err.message));
    }

    res.json({ success: true, ...result });
}));

module.exports = router;
