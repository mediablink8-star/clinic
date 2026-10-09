const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = require('../../index');
const { testPrisma, createTestClinic, createTestUser, createTestPatient, createTestDoctor, generateTestToken } = require('../setup');

describe('Authentication Integration', () => {
  let clinic, user, token;

  beforeAll(async () => {
    clinic = await createTestClinic();
    user = await createTestUser(clinic.id);
    token = generateTestToken(user.id, clinic.id, user.role);
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'TestPass123!' })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.headers['set-cookie']?.some(cookie => cookie.startsWith('refreshToken='))).toBe(true);
      expect(res.body).toHaveProperty('clinic');
      expect(res.body.clinic.id).toBe(clinic.id);
    });

    it('should reject invalid password', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'WrongPass123!' })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'TestPass123!' })
        .expect(401);
    });

    it('should lock the account after the configured failed-attempt threshold', async () => {
      let response;
      for (let i = 0; i < 12; i++) {
        response = await request(app)
          .post('/api/auth/login')
          .send({ email: user.email, password: 'WrongPass' });
        if (response.status === 429) break;
      }
      expect(response.status).toBe(429);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new clinic and owner', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          clinicName: 'New Clinic',
          email: 'owner@newclinic.com',
          password: 'SecurePass123!',
          phone: '+302109876543',
          inviteCode: process.env.SYSTEM_INVITE_CODE,
          agreedToTerms: true,
        })
        .expect(201);

      expect(res.body).toHaveProperty('token');
      expect(res.body.clinic.name).toBe('New Clinic');
      expect(res.body.clinic.role).toBe('OWNER');
    });

    it('should reject weak passwords', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          clinicName: 'Test',
          clinicPhone: '+302109876543',
          clinicEmail: 'test@clinic.com',
          ownerName: 'Owner',
          ownerEmail: 'owner@test.com',
          ownerPassword: 'weak',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: user.email, password: 'TestPass123!' });

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', loginRes.headers['set-cookie'])
        .expect(200);

      expect(res.body).toHaveProperty('token');
    });

    it('should reject invalid refresh token', async () => {
      await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid'])
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.user.id).toBe(user.id);
      expect(res.body.user.email).toBe(user.email);
    });

    it('should reject expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: user.id, clinicId: clinic.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('MFA', () => {
    it('should enable MFA and return secret', async () => {
      const res = await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('secret');
      expect(res.body).toHaveProperty('qrCode');
    });

    it('should verify MFA token', async () => {
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const userWithMFA = await testPrisma.user.findUnique({ where: { id: user.id } });
      expect(userWithMFA.mfaEnabled).toBe(false);

      const totp = require('otplib').authenticator;
      const mfaToken = totp.generate(userWithMFA.mfaPendingSecret);

      await request(app)
        .post('/api/auth/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: mfaToken })
        .expect(200);

      const verifiedUser = await testPrisma.user.findUnique({ where: { id: user.id } });
      expect(verifiedUser.mfaEnabled).toBe(true);
    });
  });

  describe('Per-clinic rate limiting', () => {
    it('should rate limit authenticated endpoints per clinic', async () => {
      // Make many requests to a protected endpoint from same clinic
      const clinic2 = await createTestClinic({ webhookSecret: 'test-secret-2' });
      const user2 = await createTestUser(clinic2.id, { role: 'OWNER', email: 'owner2@clinic.com' });
      const token2 = generateTestToken(user2.id, clinic2.id, user2.role);

      // Make requests from clinic 1 (should succeed up to limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
      }

      // Make requests from clinic 2 (separate limit)
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/auth/me')
          .set('Authorization', `Bearer ${token2}`)
          .expect(200);
      }
    });
  });
});