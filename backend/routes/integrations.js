const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { decrypt, encrypt } = require('../services/encryptionService');
const { logAction } = require('../services/auditService');
const prisma = require('../services/prisma');
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
}));

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
}));

/**
 * @route POST /api/integrations/test-webhook
 * @desc  Tests the webhook URL by sending a signed POST request.
 *        Fires once — no retries. Reports exact HTTP status back to client.
 */
router.post('/test-webhook', asyncHandler(async (req, res) => {
    const { url, secret } = req.body;

    // Validate URL format
    const targetUrl = url || req.clinic.webhookUrl;
    if (!targetUrl) {
        return res.json({ success: false, error: 'No Webhook URL configured.' });
    }
    try {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    } catch {
        return res.json({ success: false, error: 'Invalid Webhook URL format. Only HTTP/HTTPS allowed.' });
    }

    // Resolve secret — never use masked value
    let targetSecret = '';
    if (secret && secret !== '********' && !secret.startsWith('****')) {
        targetSecret = secret;
    } else if (req.clinic.webhookSecret) {
        try { targetSecret = decrypt(req.clinic.webhookSecret); } catch { targetSecret = ''; }
    }

    const payload = {
        event: 'test.webhook',
        clinicId: req.clinicId,
        timestamp: new Date().toISOString(),
        data: {
            phone: '+30690000000',
            patientName: 'Test Patient',
            date: new Date().toLocaleDateString('el-GR'),
            time: '10:00',
            appointmentId: 'test-connection-check'
        },
        clinic: { name: 'Test Clinic' }
    };

    const body = JSON.stringify(payload);
    const signature = crypto
        .createHmac('sha256', targetSecret || 'no-secret')
        .update(body)
        .digest('hex');

    const start = Date.now();
    try {
        // Single attempt, 8s timeout — no retries for test calls
        const response = await axios.post(targetUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'ngrok-skip-browser-warning': 'true'
            },
            timeout: 8000,
            // Accept any 2xx-5xx as a valid response (don't throw on 4xx/5xx)
            validateStatus: (status) => status < 600
        });

        const latency = Date.now() - start;
        const success = response.status >= 200 && response.status < 300;

        logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_WEBHOOK_CONNECTION',
            entity: 'INTEGRATION',
            details: { success, latency, status: response.status, url: targetUrl },
            ipAddress: req.ip
        }).catch(() => {});

        return res.json({
            success,
            status: response.status,
            latency,
            error: success ? null : `Server returned HTTP ${response.status}`
        });
    } catch (err) {
        const latency = Date.now() - start;
        logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'TEST_WEBHOOK_CONNECTION',
            entity: 'INTEGRATION',
            details: { success: false, error: err.message, latency, url: targetUrl },
            ipAddress: req.ip
        }).catch(() => {});

        let errorMessage = 'Connection failed.';
        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
            errorMessage = 'Timeout — URL took too long to respond (>8s)';
        } else if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
            errorMessage = 'Host not found — check the URL is correct';
        } else if (err.code === 'ECONNREFUSED') {
            errorMessage = 'Connection refused — server is not accepting connections';
        } else if (err.message) {
            errorMessage = err.message.split('\n')[0].slice(0, 120);
        }

        return res.json({ success: false, error: errorMessage, latency });
    }
}));

/**
 * @route POST /api/integrations/save-webhook
 * @desc  Saves the Webhook URL and Secret.
 */
router.post('/save-webhook', asyncHandler(async (req, res) => {
    const { 
        url, 
        secret, 
        webhookMissedCall, 
        webhookAppointment, 
        webhookReminders, 
        webhookDirectSms, 
        webhookInboundSms 
    } = req.body;

    // Reliability Rule: Prevent invalid URL saving
    const validateUrl = (u) => {
        if (!u) return true;
        try {
            const parsed = new URL(u);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch { return false; }
    };

    if (url && !validateUrl(url)) return res.status(400).json({ error: 'Invalid Global Webhook URL format.' });
    if (webhookMissedCall && !validateUrl(webhookMissedCall)) return res.status(400).json({ error: 'Invalid Missed Call Webhook URL format.' });
    if (webhookAppointment && !validateUrl(webhookAppointment)) return res.status(400).json({ error: 'Invalid Appointment Webhook URL format.' });
    if (webhookReminders && !validateUrl(webhookReminders)) return res.status(400).json({ error: 'Invalid Reminders Webhook URL format.' });
    if (webhookDirectSms && !validateUrl(webhookDirectSms)) return res.status(400).json({ error: 'Invalid Direct SMS Webhook URL format.' });
    if (webhookInboundSms && !validateUrl(webhookInboundSms)) return res.status(400).json({ error: 'Invalid Inbound SMS Webhook URL format.' });

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
                webhookUrl: url || null,
                webhookSecret: encryptedSecret,
                webhookMissedCall: webhookMissedCall || null,
                webhookAppointment: webhookAppointment || null,
                webhookReminders: webhookReminders || null,
                webhookDirectSms: webhookDirectSms || null,
                webhookInboundSms: webhookInboundSms || null
            }
        });

        await logAction({
            clinicId: req.clinicId,
            userId: req.user.userId,
            action: 'UPDATE_WEBHOOK_SETTINGS',
            entity: 'CLINIC',
            entityId: req.clinicId,
            details: { url, overrides: !!(webhookMissedCall || webhookAppointment || webhookReminders || webhookDirectSms || webhookInboundSms) },
            ipAddress: req.ip
        });

        res.json({ success: true });
    } catch (e) {
        console.error('Save Webhook settings failed:', e);
        res.status(500).json({ error: e.message });
    }
}));

module.exports = router;
