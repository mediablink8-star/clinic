const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Start seeding SaaS data...');

    // 1. Create Platform Admin FIRST (needed before clinic creation)
    const bcrypt = require('bcryptjs');
    const adminPasswordHash = await bcrypt.hash('admin123!', 10);
    const platformAdmin = await prisma.user.upsert({
        where: { email: 'admin@clinicflow.gr' },
        update: {},
        create: {
            email: 'admin@clinicflow.gr',
            passwordHash: adminPasswordHash,
            role: 'ADMIN',
            isPlatformAdmin: true,
            name: 'System Admin'
        }
    });
    console.log('✅ Platform admin created:', platformAdmin.email);

    // 2. Create Clinic A (Dental)
    const clinicA = await prisma.clinic.upsert({
        where: { id: 'demo-dental' },
        update: {},
create: {
             id: 'demo-dental',
             name: "Οδοντιατρική Φροντίδα ClinicFlow",
             location: "Αθήνα, Κέντρο",
             phone: "210 1234567",
             email: "dental@clinicflow.gr",
             workingHours: JSON.stringify({ weekdays: "09:00 - 20:00", saturday: "10:00 - 14:00" }),
             services: JSON.stringify([
                 { name: "Καθαρισμός", price: "50€" },
                 { name: "Λεύκανση", price: "200€" },
                 { name: "Εμφύτευμα", price: "800€" }
             ]),
             policies: JSON.stringify({ cancellation: "24h notice required" }),
             onboardingCompleted: true,
             smsMonthlyLimit: 200,
             aiMonthlyLimit: 100,
             messageCredits: 200,
             monthlyCreditLimit: 200,
             dailyMessageCap: 100,
             timezone: "Europe/Athens"
         }
    });
    console.log('✅ Clinic created:', clinicA.name);

    // 3. Create Owner user for demo clinic
    const ownerPasswordHash = await bcrypt.hash('owner123!', 10);
    const owner = await prisma.user.upsert({
        where: { email: 'owner@demo-clinic.gr' },
        update: {},
        create: {
            email: 'owner@demo-clinic.gr',
            passwordHash: ownerPasswordHash,
            role: 'OWNER',
            name: 'Δημήτρης Παπαδόπουλος',
            clinicId: clinicA.id
        }
    });
    console.log('✅ Clinic owner created:', owner.email);

    // 4. Create demo patients
    const patients = [
        { name: 'Γιώργος Παπαδόπουλος', phone: '6912345678', email: 'george@example.com' },
        { name: 'Μαρία Κωνσταντίνου', phone: '6987654321', email: 'maria@example.com' }
    ];
    for (const p of patients) {
        const normalizedPhone = p.phone.replace(/\s+/g, '').replace(/^30/, '+30');
        await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinicA.id, phone: normalizedPhone } },
            update: {},
            create: {
                clinicId: clinicA.id,
                name: p.name,
                phone: normalizedPhone,
                email: p.email
            }
        });
        console.log(`✅ Patient created: ${p.name}`);
    }

    // 5. Create Receptionist for demo
    const receptionPasswordHash = await bcrypt.hash('reception123!', 10);
    await prisma.user.upsert({
        where: { email: 'reception@demo-clinic.gr' },
        update: {},
        create: {
            email: 'reception@demo-clinic.gr',
            passwordHash: receptionPasswordHash,
            role: 'RECEPTIONIST',
            name: 'Ελένη Σεργίδου',
            clinicId: clinicA.id
        }
    });
    console.log('✅ Receptionist created');

    // 6. Create second demo clinic
    const clinicB = await prisma.clinic.upsert({
        where: { id: 'demo-general' },
        update: {},
create: {
             id: 'demo-general',
             name: "Γενικικό Ιατρείο ClinicFlow",
             location: "Θεσσαλονίκη, Κέντρο",
             phone: "231 0000000",
             email: "general@clinicflow.gr",
             workingHours: JSON.stringify({ weekdays: "08:00 - 19:00", saturday: "09:00 - 13:00" }),
             services: JSON.stringify([
                 { name: "Γενική Εξέταση", duration: 30, price: 50 },
                 { name: "Επείγον Περιστατικό", duration: 45, price: 70 }
             ]),
             policies: JSON.stringify({ cancellation: "24h notice required" }),
             onboardingCompleted: true,
             smsMonthlyLimit: 200,
             aiMonthlyLimit: 100,
             messageCredits: 200,
             monthlyCreditLimit: 200,
             dailyMessageCap: 100,
             timezone: "Europe/Athens"
         }
    });
    console.log('✅ Clinic created:', clinicB.name);

    const ownerBPasswordHash = await bcrypt.hash('owner456!', 10);
    await prisma.user.upsert({
        where: { email: 'owner2@demo-clinic.gr' },
        update: {},
        create: {
            email: 'owner2@demo-clinic.gr',
            passwordHash: ownerBPasswordHash,
            role: 'OWNER',
            name: 'Μαρία Αθανασίου',
            clinicId: clinicB.id
        }
    });

    console.log('✅ Seeding finished successfully!');
    console.log('📋 Summary:');
    console.log('   - 1 Platform Admin');
    console.log('   - 2 Clinics with owners');
    console.log('   - 2 Patients (demo-dental)');
    console.log('   - 1 Receptionist (demo-dental)');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });