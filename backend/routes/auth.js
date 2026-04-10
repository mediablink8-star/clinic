const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyToken, generateMfaToken } = require('../services/authService');
const { loginSchema, resetPasswordSchema, registerSchema, validate } = require('../services/validationService');
const { triggerWebhook } = require('../services/webhookService');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const asyncHandler = require('../middleware/asyncHandler');
const rateLimit = require('express-rate-limit');

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again in an hour.' }
});

const isProduction = process.env.NODE_ENV === 'production';
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const genericRegistrationError = 'Registration could not be completed with the provided details.';

const getRefreshCookieOptions = () => ({
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: refreshCookieMaxAge,
    path: '/'
});

const clearRefreshCookie = (res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
        path: '/'
    });
};

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
    const { clinicName, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(400).json({ error: genericRegistrationError });
    }

    try {
        const passwordHash = await hashPassword(password);

        // Create Clinic and User in a transaction
        const result = await prisma.$transaction(async (tx) => {
            const clinic = await tx.clinic.create({
                data: {
                    name: clinicName,
                    phone: phone,
                    email: email,
                    location: "Αθήνα, Ελλάδα", // Default location
                    services: JSON.stringify([]), // Default empty services
                    policies: JSON.stringify({}), // Default empty policies
                    // Default values for a new clinic
                    workingHours: JSON.stringify({ weekdays: "09:00 - 18:00", saturday: "Closed" }),
                    messageCredits: 100, // Free trial credits
                    dailyMessageCap: 100
                }
            });

            const user = await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    role: 'OWNER',
                    clinicId: clinic.id,
                    name: clinicName // Use clinic name as default user name
                },
                include: { clinic: true }
            });

            return user;
        });

        const accessToken = generateAccessToken({ userId: result.id, clinicId: result.clinicId, role: result.role });
        const refreshToken = generateRefreshToken({ userId: result.id });

        // Store Refresh Token in DB
        await prisma.refreshToken.create({
            data: {
                token: refreshToken,
                userId: result.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            }
        });

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

        res.json({
            token: accessToken,
            clinic: {
                id: result.clinic.id,
                name: result.clinic.name,
                email: result.email,
                role: result.role,
                userId: result.id,
                userName: result.name,
                isAdmin: false
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        if (error?.code === 'P2002') {
            return res.status(400).json({ error: genericRegistrationError });
        }
        res.status(500).json({ error: 'Server error during registration' });
    }
}));

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

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

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
}));

router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ 
        where: { email },
        include: { clinic: true }
    });

    if (!user) {
        // Security: Don't reveal if user exists
        return res.json({ success: true, message: 'Instructions sent if email exists' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await prisma.passwordResetToken.create({
        data: {
            token,
            userId: user.id,
            expiresAt
        }
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    let emailSent = false;
    try {
        emailSent = await sendPasswordResetEmail(user.email, resetLink);
    } catch (err) {
        console.error('[AUTH] Failed to send direct email:', err.message);
    }

    // Fallback: Send via Webhook (to n8n) if direct email setup fails but webhooks are active
    if (!emailSent && user.clinic.webhookUrl) {
        triggerWebhook(
            'auth.password_reset',
            {
                email: user.email,
                userName: user.name || user.email,
                resetLink,
                clinicName: user.clinic.name
            },
            user.clinic.webhookUrl,
            user.clinic.webhookSecret
        ).catch(err => console.error('[AUTH] Password reset webhook failed:', err.message));
    }

    console.log(`[AUTH] Password reset token generated for: ${email}`);

    res.json({ success: true, message: 'Instructions sent if email exists' });
}));

router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const storedToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
        where: { id: storedToken.userId },
        data: { passwordHash }
    });

    // Clean up used token
    await prisma.passwordResetToken.delete({ where: { token } });

    res.json({ success: true, message: 'Password reset successful' });
}));

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

        // Rotate: delete old token, issue new one
        const newRefreshToken = generateRefreshToken({ userId: storedToken.user.id });
        await prisma.refreshToken.delete({ where: { token: refreshToken } });
        await prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: storedToken.user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        const accessToken = generateAccessToken({
            userId: storedToken.user.id,
            clinicId: storedToken.user.clinicId,
            role: storedToken.user.role
        });

        res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions());

        res.json({ token: accessToken });
    } catch (error) {
        res.status(500).json({ error: 'Refresh failed' });
    }
}));

router.post('/logout', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    clearRefreshCookie(res);
    res.json({ success: true });
}));

router.post('/google', asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
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

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

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
}));

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
}));

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
}));

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

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

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
}));

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
}));

module.exports = router;
