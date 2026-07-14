const request = require('supertest');
const app = require('../../index');
const { testPrisma, createTestClinic, createTestUser, createTestPatient, createTestDoctor, generateTestToken } = require('../setup');

describe('Appointments Integration', () => {
  let clinic, owner, patient, doctor, token;

  beforeAll(async () => {
    clinic = await createTestClinic({ timezone: 'Europe/Athens' });
    owner = await createTestUser(clinic.id, { role: 'OWNER' });
    patient = await createTestPatient(clinic.id, { name: 'Maria Papadopoulos', phone: '+306912345678' });
    doctor = await createTestDoctor(clinic.id, { name: 'Dr. Kostas', specialty: 'Cardiology' });
    token = generateTestToken(owner.id, clinic.id, owner.role);
  });

  describe('POST /api/appointments', () => {
    it('should create appointment with date+time in clinic timezone', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: patient.id,
          reason: 'Cardiology checkup',
          date: dateStr,
          time: '10:00',
          doctorId: doctor.id,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.patientId).toBe(patient.id);
      expect(res.body.data.doctorId).toBe(doctor.id);
      expect(res.body.data.status).toBe('CONFIRMED');

      const apt = await testPrisma.appointment.findUnique({ where: { id: res.body.data.id } });
      expect(apt).not.toBeNull();
      expect(new Date(apt.startTime).getHours()).toBe(7); // 10:00 Athens = 07:00 UTC in July
    });

    it('should prevent double-booking same doctor at same time', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient.id, reason: 'First', date: dateStr, time: '11:00', doctorId: doctor.id })
        .expect(201);

      const patient2 = await createTestPatient(clinic.id, { name: 'John Doe', phone: '+306911111111' });

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient2.id, reason: 'Second', date: dateStr, time: '11:00', doctorId: doctor.id })
        .expect(409);
    });

    it('should auto-assign doctor when none specified', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 3);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient.id, reason: 'Auto assign', date: dateStr, time: '09:00' })
        .expect(201);

      expect(res.body.data.doctorId).not.toBeNull();
    });

    it('should reject appointment outside working hours', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 4);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient.id, reason: 'After hours', date: dateStr, time: '22:00' })
        .expect(400);
    });

    it('should reject invalid patientId', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: 'invalid-id', reason: 'Test', date: dateStr, time: '10:00' })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/appointments')
        .send({ patientId: patient.id, reason: 'Test', date: '2026-01-15', time: '10:00' })
        .expect(401);
    });
  });

  describe('GET /api/appointments', () => {
    it('should list appointments with pagination', async () => {
      const res = await request(app)
        .get('/api/appointments?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('totalPages');
    });

    it('should filter by date range', async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const dateFrom = nextWeek.toISOString().split('T')[0];
      const dateTo = new Date(nextWeek.getTime() + 86400000).toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/appointments?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      res.body.data.forEach(apt => {
        const aptDate = new Date(apt.startTime).toISOString().split('T')[0];
        expect(aptDate >= dateFrom && aptDate <= dateTo).toBe(true);
      });
    });

    it('should filter by doctorId', async () => {
      const res = await request(app)
        .get(`/api/appointments?doctorId=${doctor.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      res.body.data.forEach(apt => {
        expect(apt.doctorId).toBe(doctor.id);
      });
    });
  });

  describe('PUT /api/appointments/:id/status', () => {
    let appointmentId;

    beforeAll(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient.id, reason: 'Status test', date: dateStr, time: '12:00', doctorId: doctor.id });

      appointmentId = res.body.data.id;
    });

    it('should update status to CANCELLED', async () => {
      const res = await request(app)
        .put(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CANCELLED' })
        .expect(200);

      expect(res.body.data.status).toBe('CANCELLED');
    });

    it('should update status to COMPLETED', async () => {
      await request(app)
        .put(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'COMPLETED' })
        .expect(200);
    });

    it('should reject invalid status', async () => {
      await request(app)
        .put(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'INVALID' })
        .expect(400);
    });
  });

  describe('DELETE /api/appointments/:id', () => {
    it('should soft delete appointment', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 11);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientId: patient.id, reason: 'To delete', date: dateStr, time: '14:00' })
        .expect(201);

      await request(app)
        .delete(`/api/appointments/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const deleted = await testPrisma.appointment.findUnique({ where: { id: createRes.body.data.id } });
      expect(deleted.deletedAt).not.toBeNull();
    });
  });

  describe('Role-based access', () => {
    let receptionist, receptionistToken;

    beforeAll(async () => {
      receptionist = await createTestUser(clinic.id, { role: 'RECEPTIONIST', email: 'reception@clinic.com' });
      receptionistToken = generateTestToken(receptionist.id, clinic.id, receptionist.role);
    });

    it('should allow RECEPTIONIST to create appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 12);
      const dateStr = tomorrow.toISOString().split('T')[0];

      await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ patientId: patient.id, reason: 'Reception booking', date: dateStr, time: '15:00' })
        .expect(201);
    });

    it('should allow RECEPTIONIST to update status', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 13);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const createRes = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ patientId: patient.id, reason: 'Reception status', date: dateStr, time: '16:00' })
        .expect(201);

      await request(app)
        .put(`/api/appointments/${createRes.body.data.id}/status`)
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);
    });
  });
});