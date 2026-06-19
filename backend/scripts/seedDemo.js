const prisma = require('../services/prisma');
const bcrypt = require('bcryptjs');

const CLINIC_ID = 'cmo05psic0000ef1y9lmgbn9q';

async function main() {
  console.log('🎯 Seeding demo data for clinic:', CLINIC_ID);

  // 1. Verify clinic exists
  const clinic = await prisma.clinic.findUnique({ where: { id: CLINIC_ID } });
  if (!clinic) {
    console.error('❌ Clinic not found:', CLINIC_ID);
    process.exit(1);
  }
  console.log('✅ Clinic found:', clinic.name);

  // 2. Update clinic name and settings for demo
  await prisma.clinic.update({
    where: { id: CLINIC_ID },
    data: {
      name: 'Οδοντιατρικό Κέντρο Smile',
      location: 'Αθήνα, Εξάρχεια',
      phone: '210 555 0100',
      workingHours: JSON.stringify({ weekdays: '09:00 - 20:00', saturday: '10:00 - 14:00' }),
      services: JSON.stringify([
        { name: 'Καθαρισμός', price: '60€' },
        { name: 'Λεύκανση', price: '250€' },
        { name: 'Εμφύτευμα', price: '900€' },
        { name: 'Ορθοδοντική', price: '1200€' },
        { name: 'Επείγον', price: '80€' },
      ]),
      policies: JSON.stringify({ cancellation: '24h ειδοποίηση' }),
      onboardingCompleted: true,
      messageCredits: 500,
      monthlyCreditLimit: 500,
      smsMonthlyLimit: 500,
      dailyMessageCap: 200,
      timezone: 'Europe/Athens',
    },
  });
  console.log('✅ Clinic updated');

  // 3. Create demo patients (Greek names)
  const patientsData = [
    { name: 'Γιώργος Παπαδόπουλος', phone: '6971234567', email: 'g.papad@example.com' },
    { name: 'Μαρία Κωνσταντίνου', phone: '6982345678', email: 'm.konst@example.com' },
    { name: 'Νίκος Αλεξίου', phone: '6933456789', email: 'n.alexiou@example.com' },
    { name: 'Ελένη Δημητρίου', phone: '6944567890', email: 'e.dimitriou@example.com' },
    { name: 'Κώστας Γεωργίου', phone: '6955678901', email: 'k.georgiou@example.com' },
    { name: 'Σοφία Νικολάου', phone: '6966789012', email: 's.nikolaou@example.com' },
    { name: 'Αλέξανδρος Μιχαήλ', phone: '6977890123', email: 'a.michail@example.com' },
    { name: 'Χριστίνα Βασιλείου', phone: '6988901234', email: 'c.vasileiou@example.com' },
    { name: 'Πέτρος Ιωάννου', phone: '6999012345', email: 'p.ioannou@example.com' },
    { name: 'Αναστασία Χρήστου', phone: '6910123456', email: 'a.christou@example.com' },
    { name: 'Δημήτρης Σπυρίδων', phone: '6921234567', email: 'd.spyridon@example.com' },
    { name: 'Κατερίνα Παναγιώτου', phone: '6932345678', email: 'k.panagiotou@example.com' },
  ];

  const patients = [];
  for (const p of patientsData) {
    const patient = await prisma.patient.upsert({
      where: { clinicId_phone: { clinicId: CLINIC_ID, phone: p.phone } },
      update: {},
      create: { clinicId: CLINIC_ID, name: p.name, phone: p.phone, email: p.email },
    });
    patients.push(patient);
  }
  console.log(`✅ ${patients.length} patients created`);

  // 4. Create doctors
  const doctorsData = [
    { name: 'Δρ. Αντώνης Παπαδόπουλος', specialty: 'Οδοντίατρος', isActive: true },
    { name: 'Δρ. Ελένη Μαρκάντωνα', specialty: 'Ορθοδοντικός', isActive: true },
  ];
  for (const d of doctorsData) {
    await prisma.doctor.upsert({
      where: { id: `demo-doc-${d.name.slice(0, 10)}` },
      update: {},
      create: { id: `demo-doc-${d.name.slice(0, 10)}`, clinicId: CLINIC_ID, ...d },
    });
  }
  console.log(`✅ ${doctorsData.length} doctors created`);

  // 5. Create appointments — spread across last 3 months + future
  const now = new Date();
  const appointmentsData = [];

  // Past appointments (last 3 months) — mix of completed, cancelled, no-show
  for (let i = 0; i < 45; i++) {
    const daysAgo = Math.floor(Math.random() * 90) + 1;
    const hour = 9 + Math.floor(Math.random() * 10); // 9-18
    const minute = [0, 30][Math.floor(Math.random() * 2)];
    const start = new Date(now);
    start.setDate(start.getDate() - daysAgo);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const sources = ['MANUAL', 'MANUAL', 'PUBLIC_LINK', 'AI_VOICE', 'SMS_BOOKING'];
    const source = sources[Math.floor(Math.random() * sources.length)];

    appointmentsData.push({
      clinicId: CLINIC_ID,
      patientId: patients[Math.floor(Math.random() * patients.length)].id,
      startTime: start,
      endTime: end,
      status,
      source,
      priority: Math.random() > 0.8 ? 'URGENT' : 'NORMAL',
      reason: ['Καθαρισμός', 'Έλεγχος', 'Λεύκανση', 'Εμφύτευμα', 'Επείγον', 'Ορθοδοντική'][Math.floor(Math.random() * 6)],
      createdAt: new Date(start.getTime() - 2 * 24 * 60 * 60 * 1000),
    });
  }

  // Future appointments (next 2 weeks)
  for (let i = 0; i < 18; i++) {
    const daysAhead = Math.floor(Math.random() * 14) + 1;
    const hour = 9 + Math.floor(Math.random() * 10);
    const minute = [0, 30][Math.floor(Math.random() * 2)];
    const start = new Date(now);
    start.setDate(start.getDate() + daysAhead);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    appointmentsData.push({
      clinicId: CLINIC_ID,
      patientId: patients[Math.floor(Math.random() * patients.length)].id,
      startTime: start,
      endTime: end,
      status: 'CONFIRMED',
      source: ['MANUAL', 'PUBLIC_LINK', 'SMS_BOOKING'][Math.floor(Math.random() * 3)],
      priority: Math.random() > 0.85 ? 'URGENT' : 'NORMAL',
      reason: ['Καθαρισμός', 'Έλεγχος', 'Λεύκανση', 'Εμφύτευμα', 'Ορθοδοντική'][Math.floor(Math.random() * 5)],
      createdAt: new Date(),
    });
  }

  // Batch create appointments
  await prisma.appointment.createMany({ data: appointmentsData, skipDuplicates: true });
  console.log(`✅ ${appointmentsData.length} appointments created`);

  // 6. Create missed calls with recovery data — the impressive demo numbers
  const missedCallsData = [];
  const recoveryRate = 0.72; // 72% recovery rate — looks great for demo

  for (let i = 0; i < 35; i++) {
    const daysAgo = Math.floor(Math.random() * 60) + 1;
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);
    createdAt.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

    const isRecovered = Math.random() < recoveryRate;
    const recoveredAt = isRecovered ? new Date(createdAt.getTime() + Math.random() * 4 * 60 * 60 * 1000) : null;

    missedCallsData.push({
      clinicId: CLINIC_ID,
      fromNumber: patients[Math.floor(Math.random() * patients.length)].phone,
      callSid: `demo-mc-${Date.now()}-${i}`,
      patientId: patients[Math.floor(Math.random() * patients.length)].id,
      status: isRecovered ? 'RECOVERED' : (Math.random() > 0.5 ? 'RECOVERING' : 'LOST'),
      smsStatus: isRecovered ? 'sent' : (Math.random() > 0.3 ? 'sent' : 'failed'),
      smsError: null,
      estimatedRevenue: [60, 80, 200, 250, 800, 900, 1200][Math.floor(Math.random() * 7)],
      recoveredAt,
      lastSmsSentAt: new Date(createdAt.getTime() + 5 * 60 * 1000),
      createdAt,
      updatedAt: recoveredAt || createdAt,
    });
  }

  await prisma.missedCall.createMany({ data: missedCallsData, skipDuplicates: true });
  console.log(`✅ ${missedCallsData.length} missed calls created`);

  // 7. Create feed events for activity dashboard
  const feedEvents = [];
  const feedTypes = [
    { type: 'APPOINTMENT_BOOKED_VIA_CALL', title: 'Ραντεβού από AI φωνητική κλήση' },
    { type: 'APPOINTMENT_BOOKED_VIA_SMS', title: 'Ραντεβού από SMS ανάκτησης' },
    { type: 'APPOINTMENT_BOOKED_LINK', title: 'Ραντεβού μέσω συνδέσμου' },
    { type: 'AI_CALL_ANSWERED', title: 'AI κλήση απαντήθηκε' },
  ];

  for (let i = 0; i < 20; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - daysAgo);
    const ft = feedTypes[Math.floor(Math.random() * feedTypes.length)];
    feedEvents.push({
      clinicId: CLINIC_ID,
      type: ft.type,
      title: ft.title,
      patientName: patients[Math.floor(Math.random() * patients.length)].name,
      phone: patients[Math.floor(Math.random() * patients.length)].phone,
      metadata: { estimatedRevenue: [60, 80, 200, 250, 800][Math.floor(Math.random() * 5)] },
      createdAt,
    });
  }

  await prisma.feedEvent.createMany({ data: feedEvents, skipDuplicates: true });
  console.log(`✅ ${feedEvents.length} feed events created`);

  // 8. Create recovery cases
  const recoveryCasesData = missedCallsData
    .filter(mc => mc.status === 'RECOVERED' || mc.status === 'RECOVERING')
    .map(mc => ({
      clinicId: CLINIC_ID,
      patientId: mc.patientId,
      missedCallId: mc.id,
      patientPhone: mc.fromNumber,
      state: mc.status === 'RECOVERED' ? 'RECOVERED' : 'ACTIVE',
      recoveredAt: mc.recoveredAt,
      lastActivityAt: mc.lastSmsSentAt,
      createdAt: mc.createdAt,
    }));

  // Use createMany with skipDuplicates for recovery cases
  for (const rc of recoveryCasesData) {
    try {
      await prisma.recoveryCase.create({ data: rc });
    } catch (e) {
      // Skip duplicates
    }
  }
  console.log(`✅ ${recoveryCasesData.length} recovery cases created`);

  // Print summary
  const stats = await prisma.missedCall.aggregate({
    where: { clinicId: CLINIC_ID },
    _count: { id: true },
    _sum: { estimatedRevenue: true },
  });
  const recovered = await prisma.missedCall.count({
    where: { clinicId: CLINIC_ID, status: 'RECOVERED' },
  });

  console.log('');
  console.log('📊 Demo Data Summary:');
  console.log(`   Clinic: Οδοντιατρικό Κέντρο Smile`);
  console.log(`   Patients: ${patients.length}`);
  console.log(`   Doctors: ${doctorsData.length}`);
  console.log(`   Appointments: ${appointmentsData.length}`);
  console.log(`   Missed Calls: ${stats._count.id}`);
  console.log(`   Recovered: ${recovered}`);
  console.log(`   Recovery Rate: ${stats._count.id > 0 ? Math.round((recovered / stats._count.id) * 100) : 0}%`);
  console.log(`   Total Revenue: €${stats._sum.estimatedRevenue || 0}`);
  console.log('');
  console.log('✅ Demo seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
