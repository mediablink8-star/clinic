const { 
  getAvailableSlots, 
  isWithinWorkingHours, 
  getStartOfDay,
  parseDateTimeInTimezone 
} = require('../../services/slotUtils');
const { testPrisma, createTestClinic, createTestDoctor, cleanDatabase } = require('../setup');

describe('Slot Utils Unit Tests', () => {
  let clinic, doctor;

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

    doctor = await createTestDoctor(clinic.id, {
      name: 'Dr. Test',
      workingHours: JSON.stringify({
        monday: { open: '10:00', close: '16:00', closed: false },
        tuesday: { open: '10:00', close: '16:00', closed: false },
        wednesday: { closed: true },
        thursday: { open: '10:00', close: '16:00', closed: false },
        friday: { open: '10:00', close: '16:00', closed: false },
        saturday: { closed: true },
        sunday: { closed: true },
      }),
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  describe('getAvailableSlots', () => {
    it('should return 1-hour slots within working hours', async () => {
      const date = new Date('2026-01-12'); // Monday
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 60, null);

      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toMatch(/^\d{2}:\d{2}$/);
      
      // First slot should be at or after 09:00
      const firstSlot = parseInt(slots[0].split(':')[0]);
      expect(firstSlot).toBeGreaterThanOrEqual(9);
      
      // Last slot should end by 18:00
      const lastSlot = parseInt(slots[slots.length - 1].split(':')[0]);
      expect(lastSlot + 1).toBeLessThanOrEqual(18);
    });

    it('should return 30-minute slots when duration is 30', async () => {
      const date = new Date('2026-01-12'); // Monday
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 30, null);

      expect(slots.length).toBeGreaterThan(0);
      
      // Check 30-minute increments
      for (let i = 1; i < slots.length; i++) {
        const prev = slots[i - 1];
        const curr = slots[i];
        const prevMins = parseInt(prev.split(':')[0]) * 60 + parseInt(prev.split(':')[1]);
        const currMins = parseInt(curr.split(':')[0]) * 60 + parseInt(curr.split(':')[1]);
        expect(currMins - prevMins).toBe(30);
      }
    });

    it('should return empty array for closed day (Sunday)', async () => {
      const date = new Date('2026-01-11'); // Sunday
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 60, null);
      expect(slots).toEqual([]);
    });

    it('should respect doctor working hours when doctorId provided', async () => {
      const date = new Date('2026-01-12'); // Monday
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 60, doctor.id);

      // Doctor works 10:00-16:00, clinic 09:00-18:00
      // Should only return slots within doctor hours
      const firstSlot = parseInt(slots[0].split(':')[0]);
      expect(firstSlot).toBeGreaterThanOrEqual(10);
      
      const lastSlot = parseInt(slots[slots.length - 1].split(':')[0]);
      expect(lastSlot + 1).toBeLessThanOrEqual(16);
    });

    it('should return empty for doctor closed day', async () => {
      const date = new Date('2026-01-14'); // Wednesday - doctor closed
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 60, doctor.id);
      expect(slots).toEqual([]);
    });

    it('should exclude slots with existing appointments', async () => {
      // Create an appointment at 11:00 on Monday
      const aptDate = new Date('2026-01-12T09:00:00.000Z'); // 11:00 Athens time
      await testPrisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: (await testPrisma.patient.create({
            data: { clinicId: clinic.id, name: 'Test', phone: '+306999999999' }
          })).id,
          doctorId: doctor.id,
          startTime: aptDate,
          endTime: new Date(aptDate.getTime() + 60 * 60000),
          reason: 'Existing',
          status: 'CONFIRMED',
        },
      });

      const date = new Date('2026-01-12');
      const slots = await getAvailableSlots(clinic.id, date, 'Europe/Athens', 60, doctor.id);

      // 11:00 should not be available
      expect(slots).not.toContain('11:00');
    });

    it('should handle different timezone', async () => {
      const date = new Date('2026-01-12');
      const slots = await getAvailableSlots(clinic.id, date, 'America/New_York', 60, null);
      
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('isWithinWorkingHours', () => {
    it('should return true for time within clinic hours', () => {
      const start = new Date('2026-01-12T10:00:00.000Z'); // 12:00 Athens
      const end = new Date('2026-01-12T10:30:00.000Z');   // 12:30 Athens
      
      const result = isWithinWorkingHours({ clinic, start, end, timezone: 'Europe/Athens' });
      expect(result).toBe(true);
    });

    it('should return false for time before opening', () => {
      const start = new Date('2026-01-12T05:00:00.000Z'); // 07:00 Athens
      const end = new Date('2026-01-12T05:30:00.000Z');
      
      const result = isWithinWorkingHours({ clinic, start, end, timezone: 'Europe/Athens' });
      expect(result).toBe(false);
    });

    it('should return false for time after closing', () => {
      const start = new Date('2026-01-12T16:00:00.000Z'); // 18:00 Athens
      const end = new Date('2026-01-12T16:30:00.000Z');
      
      const result = isWithinWorkingHours({ clinic, start, end, timezone: 'Europe/Athens' });
      expect(result).toBe(false);
    });

    it('should respect doctor hours when doctor provided', () => {
      const start = new Date('2026-01-12T07:00:00.000Z'); // 09:00 Athens
      const end = new Date('2026-01-12T07:30:00.000Z');  // 09:30 Athens
      
      // Clinic opens at 09:00, doctor at 10:00
      const result = isWithinWorkingHours({ 
        clinic, 
        doctor, 
        start, 
        end, 
        timezone: 'Europe/Athens' 
      });
      expect(result).toBe(false);
    });

    it('should return false for closed day', () => {
      const start = new Date('2026-01-11T10:00:00.000Z'); // Sunday
      const end = new Date('2026-01-11T10:30:00.000Z');
      
      const result = isWithinWorkingHours({ clinic, start, end, timezone: 'Europe/Athens' });
      expect(result).toBe(false);
    });
  });

  describe('getStartOfDay', () => {
    it('should return start of day in given timezone', () => {
      const date = new Date('2026-01-15T15:30:00.000Z');
      const start = getStartOfDay(date, 'Europe/Athens');
      
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('should handle different timezones', () => {
      const date = new Date('2026-01-15T15:30:00.000Z');
      const startAthens = getStartOfDay(date, 'Europe/Athens');
      const startNY = getStartOfDay(date, 'America/New_York');
      
      // Different timezones should give different UTC times for start of day
      expect(startAthens.getTime()).not.toBe(startNY.getTime());
    });
  });

  describe('parseDateTimeInTimezone', () => {
    it('should parse date and time string in given timezone', () => {
      const date = '2026-01-15';
      const time = '10:30';
      const timezone = 'Europe/Athens';
      
      const result = parseDateTimeInTimezone(date, time, timezone);
      
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toContain('2026-01-15');
    });

    it('should convert to UTC correctly', () => {
      const date = '2026-01-15';
      const time = '10:00';
      const timezone = 'Europe/Athens'; // UTC+2 in winter, UTC+3 in summer
      
      const result = parseDateTimeInTimezone(date, time, timezone);
      
      // In January, Athens is UTC+2, so 10:00 Athens = 08:00 UTC
      expect(result.getUTCHours()).toBe(8);
    });

    it('should handle summer time (DST)', () => {
      const date = '2026-07-15'; // Summer
      const time = '10:00';
      const timezone = 'Europe/Athens'; // UTC+3 in summer
      
      const result = parseDateTimeInTimezone(date, time, timezone);
      
      // In July, Athens is UTC+3, so 10:00 Athens = 07:00 UTC
      expect(result.getUTCHours()).toBe(7);
    });

    it('should throw on invalid date format', () => {
      expect(() => parseDateTimeInTimezone('invalid', '10:00', 'Europe/Athens'))
        .toThrow();
    });

    it('should throw on invalid time format', () => {
      expect(() => parseDateTimeInTimezone('2026-01-15', '25:00', 'Europe/Athens'))
        .toThrow();
    });
  });
});