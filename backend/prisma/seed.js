const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Start seeding SaaS data to Supabase...');

    // 1. Create Clinic A (Dental)
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
            policies: JSON.stringify({ cancellation: "24h notice required" })
        }
    });

    // 2. Create Patients for Demo Clinic
    const patients = [
        { name: 'Γιώργος Παπαδόπουλος', phone: '6912345678', email: 'george@example.com' },
        { name: 'Μαρία Κωνσταντίνου', phone: '6987654321', email: 'maria@example.com' }
    ];

    for (const p of patients) {
        // ... (existing code)
    }

    // 3. Create Platform Admin
    const bcrypt = require('bcryptjs');
    const adminPasswordHash = await bcrypt.hash('admin123!', 10);
    await prisma.user.upsert({
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

    console.log('✅ Seeding finished successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
