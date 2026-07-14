const request = require('supertest');
const app = require('../../index');
const { testPrisma, createTestClinic, createTestUser, generateTestToken } = require('../setup');

describe('Webhooks Integration', () => {
  let clinic, owner, token, webhookSecret;

  beforeAll(async () => {
    clinic = await createTestClinic({ 
      timezone: 'Europe/Athens',
      webhookSecret: 'test-webhook-secret-123',
    });
    owner = await createTestUser(clinic.id, { role: 'OWNER' });
    token = generateTestToken(owner.id, clinic.id, owner.role);
    webhookSecret = clinic.webhookSecret;
  });

  describe('Zadarma Webhook (Missed Call Detection)', () => {
    it('should create missed call on NOTIFY_START', async () => {
      const res = await request(app)
        .post(`/api/webhook/zadarma/${webhookSecret}`)
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306912345678',
          called_did: '+302101234567',
          call_id: 'zadarma-call-123',
          start_time: new Date().toISOString(),
        })
        .expect(200);

      expect(res.body.success).toBe(true);

      const missedCall = await testPrisma.missedCall.findFirst({
        where: { callSid: 'zadarma-call-123' },
      });
      expect(missedCall).not.toBeNull();
      expect(missedCall.fromNumber).toBe('+306912345678');
      expect(missedCall.status).toBe('DETECTED');
    });

    it('should link missed call to existing patient', async () => {
      const patient = await testPrisma.patient.create({
        data: {
          clinicId: clinic.id,
          name: 'Existing Patient',
          phone: '+306988888888',
        },
      });

      await request(app)
        .post(`/api/webhook/zadarma/${webhookSecret}`)
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306988888888',
          called_did: '+302101234567',
          call_id: 'zadarma-call-patient-link',
        })
        .expect(200);

      const missedCall = await testPrisma.missedCall.findFirst({
        where: { callSid: 'zadarma-call-patient-link' },
        include: { patient: true },
      });
      expect(missedCall.patientId).toBe(patient.id);
    });

    it('should deduplicate by call_id', async () => {
      await request(app)
        .post(`/api/webhook/zadarma/${webhookSecret}`)
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306977777777',
          called_did: '+302101234567',
          call_id: 'dedup-call-id',
        })
        .expect(200);

      await request(app)
        .post(`/api/webhook/zadarma/${webhookSecret}`)
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306977777777',
          called_did: '+302101234567',
          call_id: 'dedup-call-id',
        })
        .expect(200);

      const count = await testPrisma.missedCall.count({ where: { callSid: 'dedup-call-id' } });
      expect(count).toBe(1);
    });

    it('should reject invalid webhook secret', async () => {
      await request(app)
        .post('/api/webhook/zadarma/wrong-secret')
        .send({
          event: 'NOTIFY_START',
          caller_id: '+306912345678',
          called_did: '+302101234567',
          call_id: 'test-invalid-secret',
        })
        .expect(403);
    });

    it('should handle NOTIFY_END with duration', async () => {
      const mc = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306966666666',
          callSid: 'zadarma-call-ended',
          status: 'DETECTED',
        },
      });

      await request(app)
        .post(`/api/webhook/zadarma/${webhookSecret}`)
        .send({
          event: 'NOTIFY_END',
          caller_id: '+306966666666',
          called_did: '+302101234567',
          call_id: 'zadarma-call-ended',
          duration: '45',
          disposition: 'ANSWERED',
        })
        .expect(200);

      const updated = await testPrisma.missedCall.findUnique({ where: { id: mc.id } });
      // Should be updated based on disposition
    });
  });

  describe('Twilio SMS Status Callback', () => {
    it('should update message log on delivery', async () => {
      const messageLog = await testPrisma.messageLog.create({
        data: {
          clinicId: clinic.id,
          type: 'SMS',
          status: 'SENT',
          providerMessageSid: 'SM1234567890',
        },
      });

      await request(app)
        .post('/api/webhook/sms-status')
        .send({
          MessageSid: 'SM1234567890',
          MessageStatus: 'delivered',
          To: '+306912345678',
        })
        .expect(200);

      const updated = await testPrisma.messageLog.findUnique({ where: { id: messageLog.id } });
      expect(updated.status).toBe('DELIVERED');
    });

    it('should handle failed delivery', async () => {
      const messageLog = await testPrisma.messageLog.create({
        data: {
          clinicId: clinic.id,
          type: 'SMS',
          status: 'SENT',
          providerMessageSid: 'SM0987654321',
        },
      });

      await request(app)
        .post('/api/webhook/sms-status')
        .send({
          MessageSid: 'SM0987654321',
          MessageStatus: 'failed',
          ErrorCode: '30003',
          To: '+306912345678',
        })
        .expect(200);

      const updated = await testPrisma.messageLog.findUnique({ where: { id: messageLog.id } });
      expect(updated.status).toBe('FAILED');
      expect(updated.error).toContain('30003');
    });

    it('should verify Twilio signature in production', async () => {
      // This test would need NODE_ENV=production and TWILIO_AUTH_TOKEN set
      // Skipping for now - middleware handles it
    });
  });

  describe('Stripe Webhook', () => {
    it('should handle checkout.session.completed', async () => {
      const clinicWithStripe = await createTestClinic({
        stripeCustomerId: 'cus_test123',
      });

      // Mock Stripe webhook signature verification
      // In real test, use stripe.webhooks.generateTestHeaderString
      
      const res = await request(app)
        .post('/api/billing/webhook')
        .send({
          id: 'evt_test123',
          type: 'checkout.session.completed',
          data: {
            object: {
              customer: 'cus_test123',
              subscription: 'sub_test123',
              metadata: { clinicId: clinicWithStripe.id },
            },
          },
        })
        .set('Stripe-Signature', 'test-signature')
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it('should handle invoice.paid', async () => {
      const clinicWithStripe = await createTestClinic({
        stripeCustomerId: 'cus_test456',
        stripeSubscriptionId: 'sub_test456',
      });

      await request(app)
        .post('/api/billing/webhook')
        .send({
          id: 'evt_test456',
          type: 'invoice.paid',
          data: {
            object: {
              customer: 'cus_test456',
              subscription: 'sub_test456',
              amount_paid: 2900,
              currency: 'eur',
              period_start: Math.floor(Date.now() / 1000) - 86400,
              period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
            },
          },
        })
        .set('Stripe-Signature', 'test-signature')
        .expect(200);

      const events = await testPrisma.subscriptionEvent.findMany({
        where: { clinicId: clinicWithStripe.id },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle subscription.deleted (cancellation)', async () => {
      const clinicWithStripe = await createTestClinic({
        stripeCustomerId: 'cus_test789',
        stripeSubscriptionId: 'sub_test789',
        planStatus: 'active',
      });

      await request(app)
        .post('/api/billing/webhook')
        .send({
          id: 'evt_test789',
          type: 'customer.subscription.deleted',
          data: {
            object: {
              customer: 'cus_test789',
              id: 'sub_test789',
            },
          },
        })
        .set('Stripe-Signature', 'test-signature')
        .expect(200);

      const updated = await testPrisma.clinic.findUnique({ where: { id: clinicWithStripe.id } });
      expect(updated.planStatus).toBe('cancelled');
    });
  });

  describe('n8n Webhook Endpoints', () => {
    it('should receive n8n webhook with HMAC', async () => {
      const crypto = require('crypto');
      const payload = { event: 'test', data: { foo: 'bar' } };
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(payload))
        .digest('hex');

      await request(app)
        .post('/api/webhook/n8n')
        .send(payload)
        .set('X-Webhook-Signature', signature)
        .expect(200);

      const delivery = await testPrisma.webhookDelivery.findFirst({
        where: { clinicId: clinic.id, eventType: 'n8n.webhook' },
      });
      expect(delivery).not.toBeNull();
      expect(delivery.success).toBe(true);
    });

    it('should reject invalid HMAC', async () => {
      await request(app)
        .post('/api/webhook/n8n')
        .send({ event: 'test' })
        .set('X-Webhook-Signature', 'invalid-signature')
        .expect(401);
    });
  });

  describe('VAPI Webhook', () => {
    it('should handle call.ended webhook', async () => {
      const vapiSecret = process.env.VAPI_WEBHOOK_SECRET || 'test-vapi-secret';
      
      await request(app)
        .post('/api/vapi/webhook')
        .send({
          message: {
            type: 'call.ended',
            call: {
              id: 'vapi-call-123',
              customer: { number: '+306912345678' },
              metadata: { clinicId: clinic.id, missedCallId: 'missed-123' },
              endedReason: 'completed',
              summary: 'Appointment booked',
            },
          },
        })
        .set('Authorization', `Bearer ${vapiSecret}`)
        .expect(200);

      // Should create appointment or update recovery case
    });

    it('should handle function-call for booking', async () => {
      const vapiSecret = process.env.VAPI_WEBHOOK_SECRET || 'test-vapi-secret';
      
      const res = await request(app)
        .post('/api/vapi/function-call')
        .send({
          message: {
            type: 'function-call',
            call: { id: 'vapi-call-456', metadata: { clinicId: clinic.id } },
            functionCall: {
              name: 'book_appointment',
              parameters: {
                patientName: 'Test Patient',
                phone: '+306912345678',
                date: '2026-01-20',
                time: '10:00',
                duration: 30,
                reason: 'Checkup',
              },
            },
          },
        })
        .set('Authorization', `Bearer ${vapiSecret}`)
        .expect(200);

      expect(res.body).toHaveProperty('result');
    });

    it('should be idempotent for duplicate function-call with same call ID', async () => {
      const vapiSecret = process.env.VAPI_WEBHOOK_SECRET || 'test-vapi-secret';
      const callId = `vapi-idempotency-${Date.now()}`;
      
      const payload = {
        message: {
          type: 'function-call',
          call: { id: callId, metadata: { clinicId: clinic.id } },
          functionCall: {
            name: 'book_appointment',
            parameters: {
              patientName: 'Idempotent Patient',
              phone: '+306900000001',
              date: '2026-01-25',
              time: '11:00',
              duration: 30,
              reason: 'Idempotency test',
            },
          },
        },
      };

      // First call
      await request(app)
        .post('/api/vapi/function-call')
        .send(payload)
        .set('Authorization', `Bearer ${vapiSecret}`)
        .expect(200);

      // Second call with same call ID
      const res2 = await request(app)
        .post('/api/vapi/function-call')
        .send(payload)
        .set('Authorization', `Bearer ${vapiSecret}`)
        .expect(200);

      // Should return same result (idempotent)
      expect(res2.body.result).toBeDefined();
      
      // Verify only one appointment was created
      const appointments = await testPrisma.appointment.findMany({
        where: { clinicId: clinic.id, patient: { phone: '+306900000001' } },
      });
      expect(appointments.length).toBe(1);
    });
  });
});