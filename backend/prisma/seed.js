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
        await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinicA.id, phone: p.phone } },
            update: {},
            create: {
                ...p,
                clinicId: clinicA.id,
                appointments: {
                    create: {
                        clinicId: clinicA.id,
                        startTime: new Date(),
                        endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
                        reason: p.name === 'Γιώργος Παπαδόπουλος' ? 'Πονάει το δόντι μου' : 'Καθαρισμός',
                        status: 'PENDING',
                        priority: p.name === 'Γιώργος Παπαδόπουλος' ? 'URGENT' : 'NORMAL',
                        aiClassification: p.name === 'Γιώργος Παπαδόπουλος' ? 'Έκτακτος πόνος' : 'Προγραμματισμένος έλεγχος',
                        notifications: {
                            create: {
                                clinicId: clinicA.id,
                                type: 'REMINDER',
                                message: `Ραντεβού για ${p.name}`,
                                scheduledFor: new Date()
                            }
                        }
                    }
                }
            }
        });
    }

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
