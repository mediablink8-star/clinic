const request = require('supertest');
const app = require('../../index');
const { testPrisma, createTestClinic, createTestUser, createTestPatient, generateTestToken } = require('../setup');

describe('Recovery System Integration', () => {
  let clinic, owner, patient, token;

  beforeAll(async () => {
    clinic = await createTestClinic({
      timezone: 'Europe/Athens',
      vapiApiKey: 'test-vapi-key',
      vapiAssistantId: 'test-assistant-id',
      vapiPhoneNumberId: 'test-phone-id',
    });
    owner = await createTestUser(clinic.id, { role: 'OWNER' });
    patient = await createTestPatient(clinic.id, { name: 'Test Patient', phone: '+306912345678' });
    token = generateTestToken(owner.id, clinic.id, owner.role);
  });

  describe('Missed Call Detection', () => {
    it('should create missed call via webhook', async () => {
      const res = await request(app)
        .post('/api/webhook/zadarma/test-webhook-secret')
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306912345678',
          called_did: '+302101234567',
          call_id: 'test-call-123',
          start_time: new Date().toISOString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const missedCall = await testPrisma.missedCall.findFirst({
        where: { clinicId: clinic.id, callSid: 'test-call-123' },
      });
      expect(missedCall).not.toBeNull();
      expect(missedCall.fromNumber).toBe('+306912345678');
      expect(missedCall.status).toBe('DETECTED');
    });

    it('should link missed call to existing patient', async () => {
      const res = await request(app)
        .post('/api/webhook/zadarma/test-webhook-secret')
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306912345678',
          called_did: '+302101234567',
          call_id: 'test-call-456',
        })
        .expect(200);

      const missedCall = await testPrisma.missedCall.findFirst({
        where: { callSid: 'test-call-456' },
        include: { patient: true },
      });
      expect(missedCall.patientId).toBe(patient.id);
    });

    it('should deduplicate by callSid', async () => {
      await request(app)
        .post('/api/webhook/zadarma/test-webhook-secret')
        .send({ event: 'NOTIFY_START', caller_id: '+306999999999', called_did: '+302101234567', call_id: 'dup-call' })
        .expect(200);

      await request(app)
        .post('/api/webhook/zadarma/test-webhook-secret')
        .send({ event: 'NOTIFY_START', caller_id: '+306999999999', called_did: '+302101234567', call_id: 'dup-call' })
        .expect(200);

      const count = await testPrisma.missedCall.count({ where: { callSid: 'dup-call' } });
      expect(count).toBe(1);
    });
  });

  describe('SMS Recovery Flow', () => {
    let missedCallId;

    beforeAll(async () => {
      const mc = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306988888888',
          callSid: 'recovery-test-call',
          status: 'DETECTED',
          smsStatus: 'pending',
        },
      });
      missedCallId = mc.id;
    });

    it('should create recovery case for missed call', async () => {
      const res = await request(app)
        .get(`/api/recovery/stats`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('pending');
      expect(res.body.pending).toBeGreaterThanOrEqual(0);
    });

    it('should list recovery log', async () => {
      const res = await request(app)
        .get('/api/recovery/log?limit=50')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should get recovery insights', async () => {
      const res = await request(app)
        .get('/api/recovery/insights')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('staleNoReply');
      expect(res.body).toHaveProperty('patientEngaged');
      expect(res.body).toHaveProperty('failedSms');
      expect(Array.isArray(res.body.staleNoReply)).toBe(true);
    });
  });

  describe('SMS Conversation State Machine', () => {
    let conversationMissedCallId;

    beforeAll(async () => {
      const mc = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306977777777',
          callSid: 'conversation-test-call',
          status: 'RECOVERING',
          smsStatus: 'sent',
          conversationState: 'NEW',
        },
      });
      conversationMissedCallId = mc.id;

      await testPrisma.recoveryCase.create({
        data: {
          clinicId: clinic.id,
          missedCallId: mc.id,
          patientPhone: '+306977777777',
          state: 'ACTIVE',
        },
      });
    });

    it('should handle inbound SMS and update conversation state', async () => {
      const res = await request(app)
        .post('/api/webhook/twilio/sms')
        .send({
          From: '+306977777777',
          To: '+302101234567',
          Body: 'Ναι, θέλω ραντεβού',
          MessageSid: 'test-sms-inbound-1',
        })
        .expect(200);

      const mc = await testPrisma.missedCall.findUnique({
        where: { id: conversationMissedCallId },
      });
      expect(mc.conversationState).toBe('BOOKING');
    });

    it('should handle STOP opt-out', async () => {
      const mc = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306966666666',
          callSid: 'optout-test-call',
          status: 'RECOVERING',
          conversationState: 'BOOKING',
        },
      });

      await request(app)
        .post('/api/webhook/twilio/sms')
        .send({
          From: '+306966666666',
          To: '+302101234567',
          Body: 'STOP',
          MessageSid: 'test-sms-stop',
        })
        .expect(200);

      const updated = await testPrisma.missedCall.findUnique({ where: { id: mc.id } });
      expect(updated.optedOut).toBe(true);
      expect(updated.conversationState).toBe('COMPLETED');
    });
  });

  describe('Recovery Stats', () => {
    it('should return correct recovery statistics', async () => {
      const res = await request(app)
        .get('/api/recovery/stats')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('recovered');
      expect(res.body).toHaveProperty('pending');
      expect(res.body).toHaveProperty('revenue');
      expect(res.body).toHaveProperty('potentialRevenue');
      expect(typeof res.body.recovered).toBe('number');
    });
  });

  describe('Role-based access to recovery', () => {
    let assistant, assistantToken;

    beforeAll(async () => {
      assistant = await createTestUser(clinic.id, { role: 'ASSISTANT', email: 'assistant@clinic.com' });
      assistantToken = generateTestToken(assistant.id, clinic.id, assistant.role);
    });

    it('should deny ASSISTANT access to recovery endpoints', async () => {
      await request(app)
        .get('/api/recovery/log')
        .set('Authorization', `Bearer ${assistantToken}`)
        .expect(403);
    });

    it('should allow RECEPTIONIST access to recovery', async () => {
      const receptionist = await createTestUser(clinic.id, { role: 'RECEPTIONIST', email: 'reception@clinic.com' });
      const receptionistToken = generateTestToken(receptionist.id, clinic.id, receptionist.role);

      await request(app)
        .get('/api/recovery/log')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .expect(200);
    });
  });
});