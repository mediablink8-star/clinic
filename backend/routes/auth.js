const express = require('express');
const router = express.Router();
const prisma = require('../services/prisma');
const AppError = require('../errors/AppError');
const { hashPassword, comparePassword, generateAccessToken, generateRefreshToken, verifyToken, verifyRefreshToken, generateMfaToken } = require('../services/authService');
const { encrypt, decrypt } = require('../services/encryptionService');
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

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many password reset requests. Please try again in an hour.' }
});

// Strict limiter for MFA code guessing — 5 attempts per 15 minutes per IP
const mfaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many MFA attempts. Please try again in 15 minutes.' }
});

// CSRF origin guard for cookie-only endpoints (/refresh, /logout)
// sameSite:'none' is required for cross-domain SPA+API but also allows
// cross-site cookie sending, so we enforce the Origin header ourselves.
const csrfOriginGuard = (req, res, next) => {
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
    ].filter(Boolean);
    // Allow requests with no Origin (e.g. server-to-server, curl in dev)
    if (!origin) return next();
    const isAllowed = allowedOrigins.some(o => origin.startsWith(o));
    if (!isAllowed) {
        return res.status(403).json({ error: 'CSRF check failed: origin not allowed' });
    }
    next();
};

const isProduction = process.env.NODE_ENV === 'production';
const refreshCookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const genericRegistrationError = 'Registration could not be completed with the provided details.';
const maxFailedAttempts = 5;
const lockoutMs = 15 * 60 * 1000;

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
        throw new AppError('CONFLICT', genericRegistrationError, 409);
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
                    location: "",
                    services: JSON.stringify([]),
                    policies: JSON.stringify({}),
                    workingHours: JSON.stringify({ weekdays: "09:00 - 18:00", saturday: "Closed" }),
                    messageCredits: 500,
                    dailyMessageCap: 300
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
                isAdmin: result.role === 'ADMIN' || result.role === 'OWNER'
            }
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (error?.code === 'P2002') {
            throw new AppError('CONFLICT', genericRegistrationError, 409);
        }
        throw new AppError('INTERNAL_ERROR', 'Server error during registration', 500);
    }
}));

router.post('/login', loginLimiter, validate(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { clinic: { select: { id: true, name: true, isActive: true } } }
        });

        if (!user) {
            throw new AppError('AUTH_FAILED', 'Invalid credentials', 401);
        }

        // Check per-account lockout
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new AppError('ACCOUNT_LOCKED', 'Account locked due to too many failed attempts. Try again in 15 minutes.', 429);
        }

        const isMatch = await comparePassword(password, user.passwordHash);

        if (!isMatch) {
            const failedAttempts = (user.failedAttempts || 0) + 1;
            await prisma.user.update({
                where: { id: user.id },
                data: failedAttempts >= maxFailedAttempts
                    ? { failedAttempts, lockedUntil: new Date(Date.now() + lockoutMs) }
                    : { failedAttempts }
            });
            throw new AppError('AUTH_FAILED', 'Invalid credentials', 401);
        }

        // Reset failed attempts on successful login
        await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null }
        });

        const isAdmin = user.role === 'ADMIN' || user.role === 'OWNER';

        if (user.mfaEnabled) {
            const mfaToken = generateMfaToken({ userId: user.id });
            return res.json({ mfaRequired: true, mfaToken, email: user.email });
        }

        const accessToken = generateAccessToken({ userId: user.id, clinicId: user.clinicId, role: user.role });
        const refreshToken = generateRefreshToken({ userId: user.id });

        await prisma.refreshToken.create({
            data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
        });

        res.cookie('refreshToken', refreshToken, getRefreshCookieOptions());

        if (!user.clinic) {
            throw new AppError('CONFIGURATION_ERROR', 'Account configuration error — clinic not found', 500);
        }

        res.json({
            token: accessToken,
            clinic: { id: user.clinic.id, name: user.clinic.name, email: user.email, avatarUrl: null, role: user.role, userId: user.id, userName: user.name || user.email, isAdmin }
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('INTERNAL_ERROR', 'Server error during login', 500);
    }
}));

router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const user = await prisma.user.findUnique({ 
        where: { email },
        include: {
            clinic: {
                select: {
                    id: true,
                    name: true,
                    webhookUrl: true,
                    webhookSecret: true
                }
            }
        }
    });

    if (!user) {
        // Security: Don't reveal if user exists
        return res.json({ success: true, message: 'Instructions sent if email exists' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Clean up any existing expired tokens for this user
    await prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, expiresAt: { lt: new Date() } }
    });

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
        ).catch(() => {});
    }

    if (!emailSent && !user.clinic.webhookUrl) {
    }

    res.json({ success: true, message: 'Instructions sent if email exists' });
}));

router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
    const { token, password } = req.body;

    const storedToken = await prisma.passwordResetToken.findUnique({
        where: { token },
        include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new AppError('INVALID_TOKEN', 'Invalid or expired reset token', 400);
    }

    const passwordHash = await hashPassword(password);

    await prisma.user.update({
        where: { id: storedToken.userId },
        data: { passwordHash }
    });

    // Invalidate all sessions - delete all refresh tokens for this user
    await prisma.refreshToken.deleteMany({
        where: { userId: storedToken.userId }
    });

    // Clear refresh token cookie
    clearRefreshCookie(res);

    // Clean up used token
    await prisma.passwordResetToken.delete({ where: { token } });

    res.json({ success: true, message: 'Password reset successful' });
}));

router.post('/refresh', csrfOriginGuard, asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new AppError('REFRESH_TOKEN_MISSING', 'Refresh token missing', 401);

    try {
        const storedToken = await prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true }
        });

        if (!storedToken || storedToken.expiresAt < new Date()) {
            throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
        }

        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded || decoded.userId !== storedToken.userId) {
            throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
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
        if (error instanceof AppError) throw error;
        throw new AppError('REFRESH_FAILED', 'Refresh failed', 500);
    }
}));

router.post('/logout', csrfOriginGuard, asyncHandler(async (req, res) => {
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

        // Wrap find+create in a transaction to prevent race conditions on
        // concurrent first-time Google logins from the same account
        const { clinic, user, isAdmin } = await prisma.$transaction(async (tx) => {
            let c = await tx.clinic.findFirst({
                where: { OR: [{ googleId }, { email }] }
            });
            let u;
            if (!c) {
                c = await tx.clinic.create({
                    data: {
                        name: name || 'Νέο Ιατρείο',
                        email,
                        phone: '',
                        location: '',
                        googleId,
                        avatarUrl: picture,
                        workingHours: '{}',
                        services: '[]',
                        policies: '{}'
                    }
                });
                u = await tx.user.create({
                    data: {
                        email,
                        passwordHash: 'SOCIAL_LOGIN_NO_PASSWORD',
                        role: 'OWNER',
                        clinicId: c.id
                    }
                });
            } else {
                u = await tx.user.findUnique({ where: { email } });
                if (!u) {
                    u = await tx.user.create({
                        data: {
                            email,
                            passwordHash: 'SOCIAL_LOGIN_NO_PASSWORD',
                            role: 'OWNER',
                            clinicId: c.id
                        }
                    });
                }
                if (!c.googleId) {
                    c = await tx.clinic.update({
                        where: { id: c.id },
                        data: { googleId, avatarUrl: picture }
                    });
                }
            }
            return { clinic: c, user: u, isAdmin: u.role === 'ADMIN' || u.role === 'OWNER' };
        });
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
        throw new AppError('AUTH_FAILED', 'Google authentication failed', 401);
    }
}));

// --- MFA ENDPOINTS ---

const requireAuth = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED', 'Unauthorized', 401);
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) throw new AppError('UNAUTHORIZED', 'Unauthorized', 401);
    req.user = decoded;
    next();
});

router.post('/mfa/setup', requireAuth, asyncHandler(async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(user.email, 'ClinicFlow', secret);
        const qrImageUrl = await qrcode.toDataURL(otpauth);

        // Store encrypted secret temporarily for verification
        const encryptedSecret = encrypt(secret);
        await prisma.user.update({
            where: { id: user.id },
            data: { mfaPendingSecret: encryptedSecret }
        });

        // Don't send secret to client - client just scans QR
        res.json({ qrImageUrl });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('MFA_SETUP_FAILED', 'MFA setup failed', 500);
    }
}));

router.post('/mfa/verify', requireAuth, asyncHandler(async (req, res) => {
    const { code } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user?.mfaPendingSecret) {
            throw new AppError('VALIDATION_ERROR', 'No MFA setup in progress', 400);
        }

        const pendingSecret = decrypt(user.mfaPendingSecret);
        const isValid = authenticator.check(code, pendingSecret);
        if (!isValid) throw new AppError('INVALID_MFA_CODE', 'Invalid MFA code', 400);

        // Store encrypted secret permanently
        await prisma.user.update({
            where: { id: user.id },
            data: { 
                mfaEnabled: true, 
                mfaSecret: encrypt(pendingSecret),
                mfaPendingSecret: null
            }
        });

        res.json({ success: true });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('MFA_VERIFICATION_FAILED', 'MFA verification failed', 500);
    }
}));

router.post('/mfa/login-verify', mfaLimiter, asyncHandler(async (req, res) => {
    const { mfaToken, code } = req.body;
    try {
        const decoded = verifyToken(mfaToken);
        if (!decoded || decoded.type !== 'MFA_CHALLENGE') {
            throw new AppError('INVALID_MFA_TOKEN', 'Invalid or expired MFA token', 401);
        }

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                clinic: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        });

        if (!user || !user.mfaSecret) throw new AppError('INVALID_REQUEST', 'Invalid request', 401);

        const secret = decrypt(user.mfaSecret);
        const isValid = authenticator.check(code, secret);
        if (!isValid) throw new AppError('INVALID_MFA_CODE', 'Invalid MFA code', 400);

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
                isAdmin: user.role === 'ADMIN' || user.role === 'OWNER',
                mfaEnabled: user.mfaEnabled
            }
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('MFA_LOGIN_FAILED', 'MFA login failed', 500);
    }
}));

router.post('/mfa/disable', requireAuth, asyncHandler(async (req, res) => {
    const { password } = req.body;

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });

        // Social login users have no password — skip the check
        if (user.passwordHash !== 'SOCIAL_LOGIN_NO_PASSWORD') {
            if (!password) {
                throw new AppError('VALIDATION_ERROR', 'Password required to disable MFA', 400);
            }
            const isValid = await comparePassword(password, user.passwordHash);
            if (!isValid) {
                throw new AppError('AUTH_FAILED', 'Invalid password', 401);
            }
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { mfaEnabled: false, mfaSecret: null }
        });
        res.json({ success: true });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('INTERNAL_ERROR', 'Failed to disable MFA', 500);
    }
}));

module.exports = router;
