// seed_recovery_demo.mjs - Run: node prisma/seed_recovery_demo.mjs
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

process.stdout.write('Seeding recovery demo data...\n');

const clinic = await prisma.clinic.upsert({
    where: { id: 'demo-recovery' },
    update: {},
    create: {
        id: 'demo-recovery',
        name: 'Demo Recovery Clinic',
        location: 'Athens, Kolonaki',
        phone: '210 9876543',
        email: 'demo@recovery-clinic.gr',
        isActive: true,
        workingHours: JSON.stringify({
            Monday: '09:00-17:00', Tuesday: '09:00-17:00',
            Wednesday: '09:00-17:00', Thursday: '09:00-17:00',
            Friday: '09:00-15:00',
        }),
        services: JSON.stringify([
            { name: 'General Exam', price: '60' },
            { name: 'Cardiology', price: '120' },
            { name: 'Ultrasound', price: '80' },
        ]),
        policies: JSON.stringify({ cancellation: '24h notice required' }),
        apiKeys: '{}',
        aiConfig: '{}',
    },
});
process.stdout.write('Clinic: ' + clinic.name + '\n');

const hash = await bcrypt.hash('demo1234', 10);
await prisma.user.upsert({
    where: { email: 'demo@recovery-clinic.gr' },
    update: {},
    create: {
        email: 'demo@recovery-clinic.gr',
        passwordHash: hash,
        role: 'OWNER',
        name: 'Demo User',
        clinicId: clinic.id,
    },
});
process.stdout.write('User: demo@recovery-clinic.gr / demo1234\n');

const patientData = [
    { name: 'Nikos Papadopoulos', phone: '+306911111111' },
    { name: 'Eleni Georgiou',     phone: '+306922222222' },
    { name: 'Kostas Antoniou',    phone: '+306933333333' },
    { name: 'Sofia Dimitriou',    phone: '+306944444444' },
    { name: 'Giannis Nikolaou',   phone: '+306955555555' },
];

const patients = [];
for (const p of patientData) {
    const pat = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId: clinic.id, phone: p.phone } },
        update: {},
        create: { clinicId: clinic.id, name: p.name, phone: p.phone },
    });
    patients.push(pat);
}
process.stdout.write(patients.length + ' patients created\n');

await prisma.missedCall.deleteMany({ where: { clinicId: clinic.id } });

const now = Date.now();
const h = (n) => new Date(now - n * 3600000);

const rows = [
    {
        clinicId: clinic.id, fromNumber: patients[0].phone,
        patientId: patients[0].id, callSid: 'demo_sid_001',
        status: 'RECOVERED', smsStatus: 'sent', estimatedRevenue: 120.0,
        aiConversation: JSON.stringify([
            { role: 'assistant', text: 'Hello! We saw you called. How can we help?', sentAt: h(5).toISOString() },
            { role: 'patient',   text: 'I want to book for tomorrow.', sentAt: h(4.9).toISOString() },
            { role: 'assistant', text: 'We have 10:00 tomorrow. Does that work?', sentAt: h(4.8).toISOString() },
            { role: 'patient',   text: 'Yes, perfect!', sentAt: h(4.7).toISOString() },
        ]),
        lastSmsSentAt: h(5), recoveredAt: h(4), createdAt: h(6),
    },
    {
        clinicId: clinic.id, fromNumber: patients[1].phone,
        patientId: patients[1].id, callSid: 'demo_sid_002',
        status: 'RECOVERED', smsStatus: 'sent', estimatedRevenue: 80.0,
        aiConversation: JSON.stringify([
            { role: 'assistant', text: 'Hello! We saw you called. How can we help?', sentAt: h(3).toISOString() },
            { role: 'patient',   text: 'Info about ultrasound please.', sentAt: h(2.9).toISOString() },
            { role: 'assistant', text: 'Ultrasound is 80. Want to book?', sentAt: h(2.8).toISOString() },
            { role: 'patient',   text: 'Yes please.', sentAt: h(2.7).toISOString() },
        ]),
        lastSmsSentAt: h(3), recoveredAt: h(2), createdAt: h(4),
    },
    {
        clinicId: clinic.id, fromNumber: patients[2].phone,
        patientId: patients[2].id, callSid: 'demo_sid_003',
        status: 'RECOVERING', smsStatus: 'sent', estimatedRevenue: 60.0,
        aiConversation: JSON.stringify([
            { role: 'assistant', text: 'Hello! We saw you called. How can we help?', sentAt: h(1).toISOString() },
        ]),
        lastSmsSentAt: h(1), createdAt: h(1.5),
    },
    {
        clinicId: clinic.id, fromNumber: patients[3].phone,
        patientId: patients[3].id, callSid: 'demo_sid_004',
        status: 'RECOVERING', smsStatus: 'sent', estimatedRevenue: 120.0,
        aiConversation: JSON.stringify([
            { role: 'assistant', text: 'Hello! We saw you called. How can we help?', sentAt: h(0.5).toISOString() },
            { role: 'patient',   text: 'I want a cardiology appointment.', sentAt: h(0.4).toISOString() },
        ]),
        lastSmsSentAt: h(0.5), createdAt: h(0.8),
    },
    {
        clinicId: clinic.id, fromNumber: patients[4].phone,
        callSid: 'demo_sid_005', status: 'DETECTED', smsStatus: 'pending',
        estimatedRevenue: 60.0, createdAt: new Date(now - 5 * 60000),
    },
    {
        clinicId: clinic.id, fromNumber: '+306966666666',
        callSid: 'demo_sid_006', status: 'LOST', smsStatus: 'sent',
        estimatedRevenue: 80.0,
        aiConversation: JSON.stringify([
            { role: 'assistant', text: 'Hello! We saw you called.', sentAt: h(25).toISOString() },
            { role: 'assistant', text: 'Would you like to book?', sentAt: h(23).toISOString() },
            { role: 'assistant', text: 'Last reminder - we are here if you need us.', sentAt: h(21).toISOString() },
        ]),
        lastSmsSentAt: h(21), createdAt: h(26),
    },
    {
        clinicId: clinic.id, fromNumber: '+306977777777',
        callSid: 'demo_sid_007', status: 'RECOVERING', smsStatus: 'failed',
        smsError: 'No webhook URL configured for this clinic',
        estimatedRevenue: 60.0, createdAt: h(2),
    },
];

for (const row of rows) {
    await prisma.missedCall.create({ data: row });
}

process.stdout.write(rows.length + ' missed calls seeded\n');
process.stdout.write('DETECTED:1  RECOVERING:3  RECOVERED:2  LOST:1\n');
process.stdout.write('Login: demo@recovery-clinic.gr / demo1234\n');
process.stdout.write('URL: http://localhost:5173\n');

await prisma.$disconnect();
