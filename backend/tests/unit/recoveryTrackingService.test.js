const { 
  ensureRecoveryCaseForMissedCall,
  recordOutboundMessageForMissedCall,
  recordInboundMessage,
  handleProviderStatusCallback,
  markRecoveryCaseRecovered,
  backfillRecoveryCases,
} = require('../../services/recoveryTrackingService');
const { testPrisma, createTestClinic, createTestPatient, cleanDatabase } = require('../setup');

describe('Recovery Tracking Service', () => {
  let clinic, patient;

  beforeAll(async () => {
    await cleanDatabase();
    clinic = await createTestClinic({ timezone: 'Europe/Athens' });
    patient = await createTestPatient(clinic.id, { name: 'Test Patient', phone: '+306912345678' });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  beforeEach(async () => {
    await testPrisma.activityEvent.deleteMany({});
    await testPrisma.message.deleteMany({});
    await testPrisma.conversation.deleteMany({});
    await testPrisma.recoveryCase.deleteMany({});
    await testPrisma.missedCall.deleteMany({});
  });

  describe('ensureRecoveryCaseForMissedCall', () => {
    it('should create recovery case for new missed call', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306911111111',
          callSid: 'test-call-1',
          status: 'DETECTED',
        },
      });

      const result = await ensureRecoveryCaseForMissedCall(missedCall.id);

      expect(result).toHaveProperty('id');
      expect(result.clinicId).toBe(clinic.id);
      expect(result.patientPhone).toBe('+306911111111');
      expect(result.state).toBe('ACTIVE');
      expect(result.conversation).toBeDefined();
      expect(result.conversation.patientPhone).toBe('+306911111111');
    });

    it('should link to existing patient', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: patient.phone,
          callSid: 'test-call-2',
          status: 'DETECTED',
          patientId: patient.id,
        },
      });

      const result = await ensureRecoveryCaseForMissedCall(missedCall.id);
      expect(result.patientId).toBe(patient.id);
    });

    it('should create activity event', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306922222222',
          callSid: 'test-call-3',
          status: 'DETECTED',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      const event = await testPrisma.activityEvent.findFirst({
        where: { type: 'MISSED_CALL_DETECTED', recoveryCaseId: { not: null } },
      });
      expect(event).not.toBeNull();
      expect(event.metadata.missedCallId).toBe(missedCall.id);
    });

    it('should not duplicate for same missedCallId', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306933333333',
          callSid: 'test-call-4',
          status: 'DETECTED',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);
      await ensureRecoveryCaseForMissedCall(missedCall.id);

      const count = await testPrisma.recoveryCase.count({ where: { missedCallId: missedCall.id } });
      expect(count).toBe(1);
    });

    it('should throw if missed call not found', async () => {
      await expect(ensureRecoveryCaseForMissedCall('non-existent-id')).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('recordOutboundMessageForMissedCall', () => {
    it('should record outbound message and update conversation', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306944444444',
          callSid: 'test-call-5',
          status: 'DETECTED',
        },
      });

      const result = await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: 'SENT',
        providerMessageSid: 'SM123',
        body: 'Test message',
        fromPhone: '+302101234567',
        toPhone: '+306944444444',
      });

      expect(result.recoveryCase).toBeDefined();
      expect(result.message.status).toBe('SENT');
      expect(result.message.body).toBe('Test message');
      expect(result.message.direction).toBe('OUTBOUND');

      const conversation = await testPrisma.conversation.findUnique({
        where: { id: result.recoveryCase.conversation.id },
      });
      expect(conversation.lastMessageAt).not.toBeNull();
    });

    it('should create activity event for message status', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306955555555',
          callSid: 'test-call-6',
          status: 'DETECTED',
        },
      });

      await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: 'DELIVERED',
        providerMessageSid: 'SM456',
        fromPhone: '+302101234567',
        toPhone: '+306955555555',
      });

      const event = await testPrisma.activityEvent.findFirst({
        where: { type: 'OUTBOUND_SMS_DELIVERED' },
      });
      expect(event).not.toBeNull();
    });
  });

  describe('recordInboundMessage', () => {
    it('should record inbound message and update recovery case state', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306966666666',
          callSid: 'test-call-7',
          status: 'RECOVERING',
          conversationState: 'NEW',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      const result = await recordInboundMessage({
        clinicId: clinic.id,
        fromPhone: '+306966666666',
        body: 'Yes, I want appointment',
        providerMessageSid: 'SM789',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      const recoveryCase = await testPrisma.recoveryCase.findFirst({
        where: { missedCallId: missedCall.id },
      });
      expect(recoveryCase.state).toBe('ENGAGED');
    });

    it('should handle STOP opt-out', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306977777777',
          callSid: 'test-call-8',
          status: 'RECOVERING',
          conversationState: 'BOOKING',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      await recordInboundMessage({
        clinicId: clinic.id,
        fromPhone: '+306977777777',
        body: 'STOP',
        providerMessageSid: 'SM999',
      });

      const updated = await testPrisma.missedCall.findUnique({ where: { id: missedCall.id } });
      expect(updated.optedOut).toBe(true);
      expect(updated.conversationState).toBe('COMPLETED');
    });

    it('should deduplicate by providerMessageSid', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306988888888',
          callSid: 'test-call-9',
          status: 'DETECTED',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      await recordInboundMessage({
        clinicId: clinic.id,
        fromPhone: '+306988888888',
        body: 'Test',
        providerMessageSid: 'SM-DUP',
      });

      await recordInboundMessage({
        clinicId: clinic.id,
        fromPhone: '+306988888888',
        body: 'Test',
        providerMessageSid: 'SM-DUP',
      });

      const count = await testPrisma.message.count({ where: { providerMessageSid: 'SM-DUP' } });
      expect(count).toBe(1);
    });
  });

  describe('handleProviderStatusCallback', () => {
    it('should update message status on delivery callback', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306999999999',
          callSid: 'test-call-10',
          status: 'DETECTED',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      const { recoveryCase } = await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: 'SENT',
        providerMessageSid: 'SM-CALLBACK',
        fromPhone: '+302101234567',
        toPhone: '+306999999999',
      });

      const result = await handleProviderStatusCallback({
        providerMessageSid: 'SM-CALLBACK',
        providerStatusRaw: 'delivered',
        clinicId: clinic.id,
        recoveryCaseId: recoveryCase.id,
      });

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.status).toBe('DELIVERED');
    });

    it('should handle failed delivery', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306900000000',
          callSid: 'test-call-11',
          status: 'DETECTED',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      await recordOutboundMessageForMissedCall({
        missedCallId: missedCall.id,
        status: 'SENT',
        providerMessageSid: 'SM-FAIL',
        fromPhone: '+302101234567',
        toPhone: '+306900000000',
      });

      const result = await handleProviderStatusCallback({
        providerMessageSid: 'SM-FAIL',
        providerStatusRaw: 'failed',
        errorCode: '30003',
        errorMessage: 'Unreachable',
        clinicId: clinic.id,
        recoveryCaseId: (await testPrisma.recoveryCase.findFirst({ where: { missedCallId: missedCall.id } })).id,
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('FAILED');
    });
  });

  describe('markRecoveryCaseRecovered', () => {
    it('should mark case as recovered and create event', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306911111112',
          callSid: 'test-call-12',
          status: 'RECOVERING',
        },
      });

      await ensureRecoveryCaseForMissedCall(missedCall.id);

      const result = await markRecoveryCaseRecovered({
        clinicId: clinic.id,
        missedCallId: missedCall.id,
      });

      expect(result.state).toBe('RECOVERED');
      expect(result.recoveredAt).not.toBeNull();

      const event = await testPrisma.activityEvent.findFirst({
        where: { type: 'CASE_RECOVERED' },
      });
      expect(event).not.toBeNull();
    });

    it('should not double-mark recovered case', async () => {
      const missedCall = await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306911111113',
          callSid: 'test-call-13',
          status: 'RECOVERED',
        },
      });

      const rc = await testPrisma.recoveryCase.create({
        data: {
          clinicId: clinic.id,
          missedCallId: missedCall.id,
          patientPhone: '+306911111113',
          state: 'RECOVERED',
          recoveredAt: new Date(),
        },
      });

      await testPrisma.conversation.create({
        data: {
          clinicId: clinic.id,
          recoveryCaseId: rc.id,
          patientPhone: '+306911111113',
        },
      });

      const result = await markRecoveryCaseRecovered({
        clinicId: clinic.id,
        missedCallId: missedCall.id,
      });

      expect(result).toEqual(rc);
    });
  });

  describe('backfillRecoveryCases', () => {
    it('should create recovery cases for recent missed calls without cases', async () => {
      await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306922222223',
          callSid: 'backfill-call-1',
          status: 'DETECTED',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      await testPrisma.missedCall.create({
        data: {
          clinicId: clinic.id,
          fromNumber: '+306922222224',
          callSid: 'backfill-call-2',
          status: 'RECOVERING',
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
        },
      });

      const result = await backfillRecoveryCases({ days: 2, limit: 10 });
      expect(result.processed).toBeGreaterThanOrEqual(2);

      const count = await testPrisma.recoveryCase.count({ where: { clinicId: clinic.id } });
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should respect limit', async () => {
      const result = await backfillRecoveryCases({ days: 30, limit: 1 });
      expect(result.processed).toBeLessThanOrEqual(1);
    });
  });
});