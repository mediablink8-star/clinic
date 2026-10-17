const { sendSmsWithTracking } = require('../../services/twilioService');
const { createTestClinic, createTestPatient, cleanDatabase } = require('../setup');

describe('Twilio SMS opt-out enforcement', () => {
  let clinic;
  let optedOutPatient;

  beforeAll(async () => {
    await cleanDatabase();
    clinic = await createTestClinic();
    optedOutPatient = await createTestPatient(clinic.id, {
      phone: '+306912345678',
      optedOut: true,
      optedOutAt: new Date(),
    });
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it('blocks outbound SMS to a patient who opted out before reserving credits or calling Twilio', async () => {
    const result = await sendSmsWithTracking({
      to: optedOutPatient.phone,
      body: 'You missed an appointment',
      clinicId: clinic.id,
    });

    expect(result).toEqual({
      success: false,
      error: 'Recipient has opted out of SMS messages',
      code: 'SMS_OPTED_OUT',
    });
  });
});
