const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/clinic_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';
process.env.DISABLE_REDIS = 'true';
process.env.DISABLE_WORKER = 'true';
process.env.VAPI_API_KEY = 'test-vapi-key';
process.env.VAPI_ASSISTANT_ID = 'test-assistant';
process.env.VAPI_PHONE_NUMBER_ID = 'test-phone';
process.env.TWILIO_ACCOUNT_SID = 'test-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.TWILIO_PHONE_NUMBER = '+302101234567';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.BACKEND_API_URL = 'http://localhost:4000';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';
process.env.ZADARMA_WEBHOOK_SECRET = 'test-zadarma-secret';

const testPrisma = new PrismaClient({
  log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
});

let testClinicId = null;
let testUserId = null;

async function cleanDatabase() {
  const tablenames = await testPrisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `;
  for (const { tablename } of tablenames) {
    if (tablename !== '_prisma_migrations') {
      try {
        await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      } catch (e) {
        // ignore
      }
    }
  }
}

async function createTestClinic(overrides = {}) {
  return testPrisma.clinic.create({
    data: {
      name: 'Test Clinic',
      location: 'Athens, Greece',
      phone: '+302101234567',
      email: 'test@clinic.com',
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
      services: JSON.stringify(['General Checkup', 'Dermatology', 'Cardiology']),
      policies: JSON.stringify({ cancellation: '24h notice required' }),
      ...overrides,
    },
  });
}

async function createTestUser(clinicId, overrides = {}) {
  const passwordHash = await bcrypt.hash('TestPass123!', 10);
  return testPrisma.user.create({
    data: {
      email: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@test.com`,
      passwordHash,
      role: 'RECEPTIONIST',
      clinicId,
      ...overrides,
    },
  });
}

async function createTestPatient(clinicId, overrides = {}) {
  return testPrisma.patient.create({
    data: {
      clinicId,
      name: 'Test Patient',
      phone: `+3069${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: 'patient@test.com',
      ...overrides,
    },
  });
}

async function createTestDoctor(clinicId, overrides = {}) {
  return testPrisma.doctor.create({
    data: {
      clinicId,
      name: 'Test Doctor',
      specialty: 'General',
      isActive: true,
      workingHours: JSON.stringify({}),
      ...overrides,
    },
  });
}

function generateTestToken(userId, clinicId, role = 'RECEPTIONIST', isPlatformAdmin = false) {
  return jwt.sign(
    { userId, clinicId, role, isPlatformAdmin },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function setupTestData() {
  await cleanDatabase();
  
  const clinic = await createTestClinic();
  testClinicId = clinic.id;

  const owner = await createTestUser(clinic.id, { role: 'OWNER', email: 'owner@test.com' });
  testUserId = owner.id;

  return { clinic, owner };
}

async function teardownTestData() {
  if (testClinicId) {
    await testPrisma.clinic.delete({ where: { id: testClinicId } }).catch(() => {});
  }
  await testPrisma.$disconnect();
}

if (require.main === module) {
  setupTestData()
    .then(() => console.log('Test database ready'))
    .catch(console.error);
}

module.exports = {
  testPrisma,
  createTestClinic,
  createTestUser,
  createTestPatient,
  createTestDoctor,
  generateTestToken,
  setupTestData,
  teardownTestData,
  cleanDatabase,
};