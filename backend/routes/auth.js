const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { comparePassword, generateToken } = require('../services/authService');
const { loginSchema, validate } = require('../services/validationService');

const prisma = new PrismaClient();

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client();

router.post('/login', validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;
    try {
        const clinic = await prisma.clinic.findFirst({ where: { email } });
        if (!clinic) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await comparePassword(password, clinic.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(clinic.id);
        res.json({
            token,
            clinic: {
                id: clinic.id,
                name: clinic.name,
                email: clinic.email,
                avatarUrl: clinic.avatarUrl
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error during login' });
    }
});

router.post('/google', async (req, res) => {
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

        if (!clinic) {
            // Sign-up: Create new clinic
            clinic = await prisma.clinic.create({
                data: {
                    name: name || 'Νέο Ιατρείο',
                    email: email,
                    googleId,
                    avatarUrl: picture,
                    password: 'social_login_no_password',
                    workingHours: '{}',
                    services: '[]',
                    policies: '{}'
                }
            });
        } else if (!clinic.googleId) {
            // Link existing clinic to Google
            clinic = await prisma.clinic.update({
                where: { id: clinic.id },
                data: { googleId, avatarUrl: picture }
            });
        }

        const token = generateToken(clinic.id);
        res.json({
            token,
            clinic: {
                id: clinic.id,
                name: clinic.name,
                email: clinic.email,
                avatarUrl: clinic.avatarUrl
            }
        });
    } catch (error) {
        console.error('Google Auth Error:', error);
        res.status(401).json({ error: 'Google authentication failed' });
    }
});

module.exports = router;
