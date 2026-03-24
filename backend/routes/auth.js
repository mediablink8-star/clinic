const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { comparePassword, generateAccessToken, generateRefreshToken, verifyToken, generateMfaToken } = require('../services/authService');
const { loginSchema, validate } = require('../services/validationService');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const asyncHandler = require('../middleware/asyncHandler');

const prisma = new PrismaClient();

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { clinic: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await comparePassword(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isAdmin = user.role === 'ADMIN';

        // Check if MFA is required
        if (user.mfaEnabled) {
            const mfaToken = generateMfaToken({ userId: user.id });
            return res.json({
                mfaRequired: true,
                mfaToken,
                email: user.email
            });
        }

        const accessToken = generateAccessToken({ userId: user.id, clinicId: user.clinicId, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user.id });

        // Store Refresh Token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            token: accessToken,
            clinic: {
                id: user.clinic.id,
                name: user.clinic.name,
                email: user.email,
                avatarUrl: user.clinic.avatarUrl,
                role: user.role,
                userId: user.id,
                userName: user.name || user.email,
                isAdmin
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

router.post('/refresh', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token missing' });

    try {
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        const decoded = verifyToken(refreshToken);
        if (!decoded || decoded.userId !== storedToken.userId) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const accessToken = generateAccessToken({
            userId: storedToken.user.id,
            clinicId: storedToken.user.clinicId,
            role: storedToken.user.role
        });

        res.json({ token: accessToken });
    } catch (error) {
        res.status(500).json({ error: 'Refresh failed' });
    }
});

router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.clearCookie('refreshToken');
    res.json({ success: true });
});

router.post('/google', asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID || '825946112933-2jkgj8mj9n7lkk2p9r48m8v9n5h9j9j9.apps.googleusercontent.com',
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        let clinic = await prisma.clinic.findFirst({
            where: {
                OR: [
                    { googleId },
                    { email }
                ]
            }
        });

        let user;
        if (!clinic) {
            // Sign-up: Create new clinic and admin user
            clinic = await prisma.clinic.create({
                data: {
                    name: name || 'Νέο Ιατρείο',
                    email: email,
                    phone: '',
                    location: '',
                    googleId,
                    avatarUrl: picture,
                    workingHours: '{}',
                    services: '[]',
                    policies: '{}'
                }
            });

            user = await prisma.user.create({
                data: {
                    email,
                    passwordHash: 'social_login_no_password',
                    role: 'ADMIN',
                    clinicId: clinic.id
                }
            });
        } else {
            user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        passwordHash: 'social_login_no_password',
                        role: 'ADMIN',
                        clinicId: clinic.id
                    }
                });
            }

            if (!clinic.googleId) {
                await prisma.clinic.update({
                    where: { id: clinic.id },
                    data: { googleId, avatarUrl: picture }
                });
            }
        }

        const isAdmin = user.role === 'ADMIN';
        const accessToken = generateAccessToken({ userId: user.id, clinicId: user.clinicId, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user.id });

        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            token: accessToken,
            clinic: {
                id: clinic.id,
                name: clinic.name,
                email: clinic.email,
                avatarUrl: clinic.avatarUrl,
                isAdmin,
                mfaEnabled: user.mfaEnabled
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});

// --- MFA ENDPOINTS ---

const requireAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
};

router.post('/mfa/setup', requireAuth, asyncHandler(async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, 'ClinicFlow', secret);
        const qrImageUrl = await qrcode.toDataURL(otpauth);

        // Store secret temporarily - we'll only confirm it after first verification
        // For simplicity in this demo, we'll return it and the user will send it back to verify
        res.json({ secret, qrImageUrl });
    } catch (error) {
        res.status(500).json({ error: 'MFA setup failed' });
    }
});

router.post('/mfa/verify', requireAuth, asyncHandler(async (req, res) => {
    const { secret, code } = req.body;
    try {
        const isValid = authenticator.check(code, secret);
        if (!isValid) return res.status(400).json({ error: 'Invalid MFA code' });

        await prisma.user.update({
            where: { id: req.user.userId },
            data: { mfaEnabled: true, mfaSecret: secret }
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'MFA verification failed' });
    }
});

router.post('/mfa/login-verify', asyncHandler(async (req, res) => {
    const { mfaToken, code } = req.body;
    try {
        const decoded = verifyToken(mfaToken);
        if (!decoded || decoded.type !== 'MFA_CHALLENGE') {
            return res.status(401).json({ error: 'Invalid or expired MFA token' });
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: { clinic: true }
        });

        if (!user || !user.mfaSecret) return res.status(401).json({ error: 'Invalid request' });

        const isValid = authenticator.check(code, user.mfaSecret);
        if (!isValid) return res.status(400).json({ error: 'Invalid MFA code' });

        const accessToken = generateAccessToken({ userId: user.id, clinicId: user.clinicId, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user.id });

        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({
            token: accessToken,
            clinic: {
                id: user.clinic.id,
                name: user.clinic.name,
                email: user.email,
                avatarUrl: user.clinic.avatarUrl,
                role: user.role,
                isAdmin: user.role === 'ADMIN',
                mfaEnabled: user.mfaEnabled
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'MFA login failed' });
    }
});


router.post('/mfa/disable', requireAuth, asyncHandler(async (req, res) => {
    try {
        await prisma.user.update({
            where: { id: req.user.userId },
            data: { mfaEnabled: false, mfaSecret: null }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disable MFA' });
    }
});

module.exports = router;
