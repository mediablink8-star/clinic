/**
 * Bug Condition Exploration Test — Bug 2: Public Booking Shows No Slots
 *
 * Root cause: `getAvailableSlots` in backend/services/publicService.js uses
 *   `a.startTime.getUTCHours()` to determine booked hours, but compares against
 *   local working hours (e.g., "09:00 - 17:00" in Europe/Athens = UTC+2/UTC+3).
 *
 * The bug (line in publicService.js):
 *   const bookedHours = appointments.map(a => a.startTime.getUTCHours());
 *
 * When a slot is at 10:00 local time (UTC+2), getUTCHours() returns 8.
 * The loop checks if bookedHours.includes(10) → false → slot appears available.
 * This means a booked slot at 10:00 local is NOT excluded → double-booking possible.
 *
 * Additionally, `new Date(dateStr)` without timezone creates a UTC midnight date.
 * On a UTC+2 server, '2026-04-15T00:00:00Z' is 2026-04-14T22:00:00 local → wrong day.
 *
 * Validates: Bug Condition 2 (isBugCondition_2)
 */

// Mock prisma to avoid needing a live database
jest.mock('./prisma', () => ({
  clinic: {
    findUnique: jest.fn()
  },
  appointment: {
    findMany: jest.fn()
  }
}));

const prisma = require('./prisma');
const { getAvailableSlots } = require('./publicService');

const CLINIC_ID = 'test-clinic-id';

const mockClinic = {
  id: CLINIC_ID,
  workingHours: JSON.stringify({
    weekdays: '09:00 - 17:00',
    saturday: 'Closed',
    sunday: 'Closed'
  })
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.clinic.findUnique.mockResolvedValue(mockClinic);
  prisma.appointment.findMany.mockResolvedValue([]);
});

/**
 * Bug Condition Test 1:
 * A clinic has working hours configured (09:00-17:00 on weekdays).
 * No appointments exist for the test date.
 * getAvailableSlots should return 8 slots (09:00 through 16:00).
 *
 * EXPECTED ON UNFIXED CODE: Returns slots correctly when no appointments exist.
 * The UTC bug only manifests when appointments DO exist (see test 2).
 */
test('BUG2: getAvailableSlots returns slots for a weekday with no appointments', async () => {
  // 2026-04-15 is a Wednesday
  const slots = await getAvailableSlots(CLINIC_ID, '2026-04-15');

  // Should return 8 slots: 09:00 through 16:00
  // BUG CONDITION: On unfixed code, this may fail if date parsing is wrong
  expect(slots.length).toBeGreaterThan(0);
  expect(slots).toContain('09:00');
  expect(slots).toContain('16:00');
  expect(slots).not.toContain('17:00');
});

/**
 * Bug Condition Test 2 (PRIMARY BUG):
 * A slot is booked at 10:00 local time.
 * On a UTC+2 server, getUTCHours() returns 8 for a 10:00 local appointment.
 * The loop checks bookedHours.includes(10) → false → slot appears available.
 *
 * EXPECTED ON UNFIXED CODE: '10:00' appears in slots even though it's booked.
 * This assertion FAILS on unfixed code (confirms the bug).
 *
 * Validates: isBugCondition_2 — UTC vs local mismatch causes wrong slot exclusion
 */
test('BUG2: booked slot at local 10:00 is correctly excluded from available slots', async () => {
  // Simulate an appointment stored at 10:00 local time (UTC+2 = 08:00 UTC)
  // This is what Prisma returns from the database — a Date object
  const localTenAM = new Date(2026, 3, 15, 10, 0, 0); // April 15, 2026 10:00 LOCAL time

  prisma.appointment.findMany.mockResolvedValue([
    { startTime: localTenAM }
  ]);

  const slots = await getAvailableSlots(CLINIC_ID, '2026-04-15');

  // BUG CONDITION: On unfixed code (getUTCHours):
  //   localTenAM.getUTCHours() = 8 (in UTC+2 environment) or 10 (in UTC environment)
  //   bookedHours = [8] (UTC+2) or [10] (UTC)
  //   In UTC+2: bookedHours.includes(10) → false → '10:00' appears in slots (BUG!)
  //   In UTC: bookedHours.includes(10) → true → '10:00' excluded (works by accident)
  //
  // On FIXED code (getHours):
  //   localTenAM.getHours() = 10 (always local)
  //   bookedHours = [10]
  //   bookedHours.includes(10) → true → '10:00' NOT in slots (correct!)
  //
  // This test FAILS on unfixed code in UTC+2 environments:
  expect(slots).not.toContain('10:00');
});

/**
 * Bug Condition Test 3:
 * Verify the UTC mismatch directly — getUTCHours() vs getHours() for a local time.
 * This is the core of the bug.
 *
 * EXPECTED ON UNFIXED CODE: getUTCHours() returns a different value than getHours()
 * in non-UTC timezones, causing the slot exclusion to fail.
 */
test('BUG2: UTC hours mismatch — getUTCHours() differs from getHours() in non-UTC timezone', () => {
  // Create a date at 10:00 local time
  const localTenAM = new Date(2026, 3, 15, 10, 0, 0);

  const localHour = localTenAM.getHours();       // Always 10 (local)
  const utcHour = localTenAM.getUTCHours();       // 8 in UTC+2, 10 in UTC

  // The bug: publicService.js uses getUTCHours() but the working hours loop
  // iterates over LOCAL hours (startH to endH from "09:00 - 17:00")
  //
  // In UTC+2: localHour=10, utcHour=8 → mismatch → slot not excluded
  // In UTC: localHour=10, utcHour=10 → no mismatch → works by accident
  //
  // The fix should use getHours() (local) to match the working hours format
  console.log(`Local hour: ${localHour}, UTC hour: ${utcHour}`);
  console.log(`Timezone offset: ${localTenAM.getTimezoneOffset()} minutes`);

  if (localTenAM.getTimezoneOffset() !== 0) {
    // In non-UTC timezone: UTC hours differ from local hours
    // This is the bug condition — getUTCHours() will return wrong value
    expect(utcHour).not.toBe(localHour);
    console.log('BUG CONFIRMED: UTC hours differ from local hours in this timezone');
  } else {
    // In UTC timezone: hours are the same, bug doesn't manifest
    expect(utcHour).toBe(localHour);
    console.log('NOTE: Running in UTC timezone — bug may not manifest in this environment');
    console.log('The bug is confirmed by code inspection: getUTCHours() is used instead of getHours()');
  }
});

/**
 * Regression Test: Closed day returns empty slots
 */
test('REGRESSION: Saturday (Closed) returns empty slots', async () => {
  // 2026-04-18 is a Saturday
  const slots = await getAvailableSlots(CLINIC_ID, '2026-04-18');
  expect(slots).toEqual([]);
});

/*
 * FAILURE OUTPUT (expected on unfixed code in UTC+2 environment):
 *
 * FAIL backend/services/publicSlots.bugcondition.test.js
 *   BUG2: booked slot at local 10:00 is correctly excluded from available slots
 *     expect(received).not.toContain(expected)
 *     Expected: not to contain "10:00"
 *     Received: ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]
 *
 * This confirms the bug: getUTCHours() returns 8 for a 10:00 local appointment (UTC+2),
 * so bookedHours=[8], and bookedHours.includes(10) is false → slot appears available.
 *
 * In UTC environment: the test may pass by accident (UTC hours = local hours).
 * The bug is still confirmed by code inspection (getUTCHours vs getHours).
 */
