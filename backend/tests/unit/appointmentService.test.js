const { 
  createAppointment, 
  updateAppointmentStatus, 
  deleteAppointment, 
  restoreAppointment,
  listAppointments,
  getAvailableSlots,
  sendConfirmationSms,
  scheduleAppointmentReminder,
} = require('../../services/appointmentService');
const { testPrisma, createTestClinic, createTestUser, createTestPatient, createTestDoctor, generateTestToken, cleanDatabase } = require('../setup');

describe('Appointment Service Unit Tests', () => {
  let clinic, owner, patient, doctor, actor;

  beforeAll(async () => {
    await cleanDatabase();
    
    clinic = await createTestClinic({ 
      timezone: 'Europe/Athens',
      workingHours: JSON.stringify({
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '09:00', close: '14:00', closed: false },
        sunday: { closed: true },
      }),
    });
    
    owner = await createTestUser(clinic.id, { role: 'OWNER', email: 'owner@test.com' });
    patient = await createTestPatient(clinic.id, { name: 'Maria Papadopoulos', phone: '+306912345678' });
    doctor = await createTestDoctor(clinic.id, { name: 'Dr. Kostas', specialty: 'Cardiology' });
    
    actor = { userId: owner.id, ip: '127.0.0.1', role: 'OWNER' };
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('createAppointment', () => {
    it('should create appointment with date/time in clinic timezone', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'Cardiology checkup',
        date: dateStr,
        time: '10:00',
        doctorId: doctor.id,
      }, actor);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id');
      expect(result.data.patientId).toBe(patient.id);
      expect(result.data.doctorId).toBe(doctor.id);
      expect(result.data.status).toBe('CONFIRMED');
      expect(result.data.source).toBe('MANUAL');

      // Verify timezone conversion (10:00 Athens = 07:00 UTC in summer)
      const startTime = new Date(result.data.startTime);
      expect(startTime.getUTCHours()).toBe(7); // 10:00 EEST = 07:00 UTC
    });

    it('should create appointment with startTime/endTime directly', async () => {
      const start = new Date();
      start.setDate(start.getDate() + 2);
      start.setHours(11, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'Direct time appointment',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      }, actor);

      expect(result.success).toBe(true);
      expect(new Date(result.data.startTime).toISOString()).toBe(start.toISOString());
    });

    it('should auto-assign doctor when none specified', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'Auto assign doctor',
        date: dateStr,
        time: '12:00',
      }, actor);

      expect(result.success).toBe(true);
      expect(result.data.doctorId).not.toBeNull();
    });

    it('should reject appointment outside working hours', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 4);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await expect(createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'After hours',
        date: dateStr,
        time: '20:00', // Outside 09:00-18:00
      }, actor)).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should reject appointment for non-existent patient', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await expect(createAppointment({
        clinicId: clinic.id,
        patientId: 'non-existent-id',
        reason: 'Test',
        date: dateStr,
        time: '10:00',
      }, actor)).rejects.toThrow('NOT_FOUND');
    });

    it('should prevent double-booking same doctor at same time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 6);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // First appointment
      await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'First appointment',
        date: dateStr,
        time: '14:00',
        doctorId: doctor.id,
      }, actor);

      // Second patient
      const patient2 = await createTestPatient(clinic.id, { name: 'Second Patient', phone: '+306911111111' });

      // Try to book same slot
      await expect(createAppointment({
        clinicId: clinic.id,
        patientId: patient2.id,
        reason: 'Second appointment',
        date: dateStr,
        time: '14:00',
        doctorId: doctor.id,
      }, actor)).rejects.toThrow('CONFLICT');
    });

    it('should reject appointment without patientId', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 7);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await expect(createAppointment({
        clinicId: clinic.id,
        reason: 'No patient',
        date: dateStr,
        time: '10:00',
      }, actor)).rejects.toThrow('VALIDATION_ERROR');
    });
  });

  describe('updateAppointmentStatus', () => {
    let appointmentId;

    beforeAll(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 8);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'Status test',
        date: dateStr,
        time: '15:00',
      }, actor);
      appointmentId = result.data.id;
    });

    it('should update status to CANCELLED', async () => {
      const result = await updateAppointmentStatus({
        clinicId: clinic.id,
        appointmentId,
        status: 'CANCELLED',
      }, actor);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('CANCELLED');
    });

    it('should update status to COMPLETED', async () => {
      // Re-create appointment since it was cancelled
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 9);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'Complete test',
        date: dateStr,
        time: '16:00',
      }, actor);

      const updateResult = await updateAppointmentStatus({
        clinicId: clinic.id,
        appointmentId: result.data.id,
        status: 'COMPLETED',
      }, actor);

      expect(updateResult.success).toBe(true);
      expect(updateResult.data.status).toBe('COMPLETED');
    });

    it('should reject invalid status', async () => {
      await expect(updateAppointmentStatus({
        clinicId: clinic.id,
        appointmentId,
        status: 'INVALID_STATUS',
      }, actor)).rejects.toThrow('VALIDATION_ERROR');
    });

    it('should reject non-existent appointment', async () => {
      await expect(updateAppointmentStatus({
        clinicId: clinic.id,
        appointmentId: 'non-existent-id',
        status: 'CANCELLED',
      }, actor)).rejects.toThrow('NOT_FOUND');
    });
  });

  describe('deleteAppointment (soft delete)', () => {
    it('should soft delete appointment', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'To delete',
        date: dateStr,
        time: '17:00',
      }, actor);

      await deleteAppointment({ clinicId: clinic.id, appointmentId: result.data.id }, actor);

      const deleted = await testPrisma.appointment.findUnique({ where: { id: result.data.id } });
      expect(deleted.deletedAt).not.toBeNull();
    });

    it('should restore soft-deleted appointment', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 11);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = await createAppointment({
        clinicId: clinic.id,
        patientId: patient.id,
        reason: 'To restore',
        date: dateStr,
        time: '09:00',
      }, actor);

      await deleteAppointment({ clinicId: clinic.id, appointmentId: result.data.id }, actor);
      await restoreAppointment({ clinicId: clinic.id, appointmentId: result.data.id }, actor);

      const restored = await testPrisma.appointment.findUnique({ where: { id: result.data.id } });
      expect(restored.deletedAt).toBeNull();
    });
  });

  describe('listAppointments', () => {
    it('should list appointments with pagination', async () => {
      const result = await listAppointments(clinic.id, null, 1, 10);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 10);
      expect(result).toHaveProperty('totalPages');
    });

    it('should filter by doctorId', async () => {
      const result = await listAppointments(clinic.id, doctor.id, 1, 10);
      
      result.data.forEach(apt => {
        expect(apt.doctorId).toBe(doctor.id);
      });
    });

    it('should filter by date range', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dateFrom = nextWeek.toISOString().split('T')[0];
      const dateTo = new Date(nextWeek.getTime() + 86400000).toISOString().split('T')[0];

      const result = await listAppointments(clinic.id, null, 1, 10, false, null, dateFrom, dateTo);
      
      result.data.forEach(apt => {
        const aptDate = new Date(apt.startTime).toISOString().split('T')[0];
        expect(aptDate >= dateFrom && aptDate <= dateTo).toBe(true);
      });
    });

    it('should include patient and doctor relations', async () => {
      const result = await listAppointments(clinic.id, null, 1, 5);
      
      if (result.data.length > 0) {
        expect(result.data[0]).toHaveProperty('patient');
        expect(result.data[0]).toHaveProperty('doctor');
      }
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for a date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 12);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const slots = await getAvailableSlots(clinic.id, dateStr);
      
      expect(Array.isArray(slots)).toBe(true);
      expect(slots.length).toBeGreaterThan(0);
      expect(typeof slots[0]).toBe('string');
      expect(slots[0]).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should filter by doctor', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 13);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const slots = await getAvailableSlots(clinic.id, dateStr, doctor.id);
      
      expect(Array.isArray(slots)).toBe(true);
    });
  });

  describe('sendConfirmationSms', () => {
    it('should return early if no patient phone', async () => {
      const patientNoPhone = await createTestPatient(clinic.id, { 
        name: 'No Phone', 
        phone: null 
      });
      
      const appointment = { startTime: new Date().toISOString() };
      const clinicObj = { id: clinic.id, name: 'Test Clinic', timezone: 'Europe/Athens' };
      
      const result = await sendConfirmationSms({ 
        appointment, 
        patient: patientNoPhone, 
        clinic: clinicObj 
      });
      
      expect(result).toBeUndefined();
    });

    it('should format message in clinic timezone', async () => {
      const appointment = { 
        startTime: new Date('2026-07-15T07:00:00Z').toISOString(), // 10:00 Athens
        doctor: { name: 'Dr. Test' }
      };
      const clinicObj = { id: clinic.id, name: 'Test Clinic', timezone: 'Europe/Athens' };
      
      // This would normally call sendDirectMessage, just verify it doesn't throw
      await expect(sendConfirmationSms({ 
        appointment, 
        patient, 
        clinic: clinicObj 
      })).resolves.not.toThrow();
    });
  });

  describe('scheduleAppointmentReminder', () => {
    it('should not schedule reminder if less than 25 hours away', async () => {
      const soon = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20 hours
      const appointment = { 
        id: 'apt-soon', 
        clinicId: clinic.id, 
        startTime: soon.toISOString() 
      };
      const clinicObj = { id: clinic.id, name: 'Test Clinic', timezone: 'Europe/Athens' };
      
      await expect(scheduleAppointmentReminder({ 
        appointment, 
        patient, 
        clinic: clinicObj 
      })).resolves.not.toThrow();
      
      // Verify no notification was created
      const notification = await testPrisma.notification.findFirst({
        where: { appointmentId: 'apt-soon', type: 'REMINDER' }
      });
      expect(notification).toBeNull();
    });

    it('should not create duplicate reminders', async () => {
      const future = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const appointment = { 
        id: 'apt-duplicate', 
        clinicId: clinic.id, 
        startTime: future.toISOString() 
      };
      const clinicObj = { id: clinic.id, name: 'Test Clinic', timezone: 'Europe/Athens' };
      
      await scheduleAppointmentReminder({ appointment, patient, clinic: clinicObj });
      await scheduleAppointmentReminder({ appointment, patient, clinic: clinicObj });
      
      const notifications = await testPrisma.notification.findMany({
        where: { appointmentId: 'apt-duplicate', type: 'REMINDER' }
      });
      expect(notifications.length).toBe(1);
    });
  });
});