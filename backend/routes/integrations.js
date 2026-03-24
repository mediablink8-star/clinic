const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { decrypt, encrypt } = require('../services/encryptionService');
const { logAction } = require('../services/auditService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');
const axios = require('axios');
const { validate, webhookSchema } = require('../services/validationService');
const asyncHandler = require('../middleware/asyncHandler');

// --- RELIABILITY UTILS ---
const withRetries = async (fn, desc = 'Action', maxRetries = 3) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            console.warn(`[RETRY] ${desc} attempt ${i + 1}/${maxRetries} failed:`, err.message);
            if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000));
        }
    }
    throw lastError;
};

/**
 * @route POST /api/integrations/test-ai
 * @desc  Tests AI provider connectivity using the stored or provided API key.
 *        If `key` is provided in the body (and not masked), it tests that key directly
 *        without requiring it to be saved first.
 * @body  { provider: 'gemini', key?: 'AIza...' }
 * @returns { success: true, latency: 320, provider: 'gemini' }
 *       or { success: false, error: 'Invalid API key' }
 */
router.post('/test-ai', asyncHandler(async (req, res) => {
    const clinic = req.clinic;
    const { provider = 'gemini', key } = req.body;

    if (provider !== 'gemini') {
        return res.json({ success: false, error: `Provider "${provider}" is not yet supported.` });
    }

    // Resolve which key to test: prefer body key if it looks real (not the masked placeholder)
    let resolvedKey = null;
    if (key && key !== '********') {
        resolvedKey = key.replace(/[^\x00-\x7F]/g, '').trim();
    } else {
        const storedKeys = JSON.parse(clinic.apiKeys || '{}');
        if (storedKeys.gemini) {
            resolvedKey = decrypt(storedKeys.gemini);
        }
    }

    if (!resolvedKey) {
        return res.json({ success: false, error: 'No API key configured. Please enter and save a key first.' });
    }

    const start = Date.now();
    try {
        await withRetries(async () => {
            const genAI = new GoogleGenerativeAI(resolvedKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            // Strict 5s timeout for AI call
            const aiCall = model.generateContent('Reply OK');
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('ECONNABORTED')), 5000)
            );

            await Promise.race([aiCall, timeoutPromise]);
        }, 'AI Connection Test');

        const latency = Date.now() - start;
        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_AI_CONNECTION',
            entity: 'INTEGRATION',
            details: { provider, success: true, latency },
            ipAddress: req.ip
        });
        res.json({ success: true, latency, provider: 'gemini' });
    } catch (err) {
        const latency = Date.now() - start;
        console.error(`[INTEGRATION_ERROR] AI Test Failed:`, err);

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_AI_CONNECTION',
            entity: 'INTEGRATION',
            details: { provider, success: false, error: err.message, latency },
            ipAddress: req.ip
        });

        let errorMsg = 'Connection failed.';
        if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('400')) {
            errorMsg = 'Invalid API key.';
        } else if (err.message?.includes('403')) {
            errorMsg = 'API key lacks required permissions.';
        } else if (err.message?.includes('quota') || err.message?.includes('429')) {
            errorMsg = 'Quota exceeded.';
        } else if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOTFOUND') || err.message?.includes('Error fetching')) {
            errorMsg = 'Cannot reach Google API — check network/firewall. Key was saved successfully.';
        } else if (err.message) {
            errorMsg = err.message.split('\n')[0].slice(0, 120);
        }
        res.json({ success: false, error: errorMsg, latency, provider: 'gemini' });
    }
});

/**
 * @route POST /api/integrations/test-twilio
 * @desc  Tests Twilio connectivity.
 */
router.post('/test-twilio', asyncHandler(async (req, res) => {
    const { sid, token } = req.body;
    let resolvedSid = sid;
    let resolvedToken = token;

    if (!sid || sid === '********') {
        const storedKeys = JSON.parse(req.clinic.apiKeys || '{}');
        resolvedSid = decrypt(storedKeys.twilioSid);
    }
    if (!token || token === '********') {
        const storedKeys = JSON.parse(req.clinic.apiKeys || '{}');
        resolvedToken = decrypt(storedKeys.twilioToken);
    }

    if (!resolvedSid || !resolvedToken) {
        return res.json({ success: false, error: 'Twilio credentials missing.' });
    }

    const start = Date.now();
    try {
        const Twilio = require('twilio');
        const client = new Twilio(resolvedSid, resolvedToken);

        // In Twilio Node v5, use the api.v2010 namespace
        await client.api.v2010.accounts(resolvedSid).fetch();

        const latency = Date.now() - start;
        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_TWILIO_CONNECTION',
            entity: 'INTEGRATION',
            details: { success: true, latency },
            ipAddress: req.ip
        });
        res.json({ success: true, latency });
    } catch (err) {
        console.error('[INTEGRATION_ERROR] Twilio Test Failed:', err);
        res.json({ success: false, error: err.message, latency: Date.now() - start });
    }
});

/**
 * @route POST /api/integrations/save-ai-key
 * @desc  Encrypts and saves the AI provider API key for the clinic.
 */
router.post('/save-ai-key', asyncHandler(async (req, res) => {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
    }
    const { provider = 'gemini', key } = req.body;

    if (!key || key.startsWith('********')) {
        return res.status(400).json({ error: 'Please provide a valid API key.' });
    }

    // Strip non-ASCII characters (e.g. em dashes, smart quotes from copy-paste)
    const cleanKey = key.replace(/[^\x00-\x7F]/g, '').trim();

    if (cleanKey.length < 16) {
        return res.status(400).json({ error: 'Invalid API key format (too short or contains invalid characters).' });
    }

    try {
        const currentKeys = JSON.parse(req.clinic.apiKeys || '{}');
        currentKeys[provider] = encrypt(cleanKey);

        await prisma.clinic.update({
            where: { id: req.clinicId },
            data: { apiKeys: JSON.stringify(currentKeys) }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_AI_KEY',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: { provider },
            ipAddress: req.ip
        });

        res.json({ success: true });
    } catch (e) {
        console.error('Save AI key failed:', e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * @route POST /api/integrations/save-twilio-keys
 * @desc  Encrypts and saves the Twilio credentials.
 */
router.post('/save-twilio-keys', asyncHandler(async (req, res) => {
    if (!['OWNER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ error: 'Απαιτείται ρόλος Ιδιοκτήτη.' });
    }
    const { sid, token, phone } = req.body;

    try {
        const currentKeys = JSON.parse(req.clinic.apiKeys || '{}');
        if (sid && sid !== '********') currentKeys.twilioSid = encrypt(sid);
        if (token && token !== '********') currentKeys.twilioToken = encrypt(token);
        if (phone) currentKeys.twilioPhone = phone;

        await prisma.clinic.update({
            where: { id: req.clinicId },
            data: { apiKeys: JSON.stringify(currentKeys) }
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * @route POST /api/integrations/test-webhook
 * @desc  Tests the webhook URL by sending a signed POST request.
 */
router.post('/test-webhook', asyncHandler(async (req, res) => {
    const { url, secret } = req.body;

    // Reliability: Validate URL format
    if (url) {
        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        } catch {
            return res.json({ success: false, error: 'Invalid Webhook URL format. Only HTTP/HTTPS allowed.' });
        }
    }

    const targetUrl = url || req.clinic.webhookUrl;
    let targetSecret = secret;

    // Resolve secret: if provided and not masked, use it. Otherwise use stored (and decrypt)
    if (secret && secret !== '********') {
        targetSecret = secret;
    } else if (req.clinic.webhookSecret) {
        targetSecret = decrypt(req.clinic.webhookSecret);
    }

    if (!targetUrl) {
        return res.json({ success: false, error: 'No Webhook URL configured.' });
    }

    const payload = {
        event: 'test.webhook',
        clinicId: req.clinicId,
        timestamp: new Date().toISOString()
    };

    const body = JSON.stringify(payload);
    const signature = crypto
        .createHmac('sha256', targetSecret || '')
        .update(body)
        .digest('hex');

    const start = Date.now();
    try {
        const response = await withRetries(async () => {
            return await axios.post(targetUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature
                },
                timeout: 5000
            });
        }, 'Webhook Test');

        const latency = Date.now() - start;
        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_WEBHOOK_CONNECTION',
            entity: 'INTEGRATION',
            details: { success: true, latency, status: response.status, url: targetUrl },
            ipAddress: req.ip
        });
        res.json({
            success: true,
            status: response.status,
            latency
        });
    } catch (err) {
        const latency = Date.now() - start;
        console.error(`[INTEGRATION_ERROR] Webhook Test Failed:`, err);
        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_WEBHOOK_CONNECTION',
            entity: 'INTEGRATION',
            details: { success: false, error: err.message, latency, url: targetUrl },
            ipAddress: req.ip
        });
        let errorMessage = 'Webhook test failed.';

        if (err.code === 'ECONNABORTED') {
            errorMessage = 'Timeout (URL took >5s to respond)';
        } else if (err.response) {
            errorMessage = `Invalid response (Status ${err.response.status})`;
        } else if (err.request) {
            errorMessage = 'Connection failed (Wait timed out or host unreachable)';
        } else {
            errorMessage = err.message;
        }

        res.json({
            success: false,
            error: errorMessage,
            latency
        });
    }
});

/**
 * @route POST /api/integrations/save-webhook
 * @desc  Saves the Webhook URL and Secret.
 */
router.post('/save-webhook', asyncHandler(async (req, res) => {
    const { url, secret } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Webhook URL is required.' });
    }
    // Reliability Rule: Prevent invalid URL saving
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
        return res.status(400).json({ error: 'Invalid Webhook URL format. Only HTTP/HTTPS allowed.' });
    }

    try {
        let encryptedSecret = undefined;
        if (secret) {
            if (secret.startsWith('********')) {
                // Keep existing secret if it's the masked version
                encryptedSecret = req.clinic.webhookSecret;
            } else {
                encryptedSecret = encrypt(secret);
            }
        }

        await prisma.clinic.update({
            where: { id: req.clinicId },
            data: {
                webhookUrl: url,
                webhookSecret: encryptedSecret
            }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_WEBHOOK_SETTINGS',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: { url },
            ipAddress: req.ip
        });

        res.json({ success: true });
    } catch (e) {
        console.error('Save Webhook settings failed:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
