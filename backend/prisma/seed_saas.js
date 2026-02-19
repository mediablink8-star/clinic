const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Start seeding SaaS data...');

    // 1. Create Clinic A (Dental)
    const clinicA = await prisma.clinic.create({
        data: {
            name: "ClinicFlow Dental Care",
            location: "Athens, Center",
            phone: "210 1234567",
            email: "info@clinicflow.com",
            workingHours: JSON.stringify({ weekdays: "09:00 - 20:00", saturday: "10:00 - 14:00" }),
            services: JSON.stringify([
                { name: "Καθαρισμός", price: "50€" },
                { name: "Λεύκανση", price: "200€" }
            ]),
            policies: JSON.stringify({ cancellation: "24h notice required" })
        }
    });
    console.log(`Created Clinic A: ${clinicA.name} (${clinicA.id})`);

    // 2. Create Clinic B (Dermatology) - DIFFERENT DOMAIN
    const clinicB = await prisma.clinic.create({
        data: {
            name: "DermaGlow Skin Clinic",
            location: "Kifisia, North",
            phone: "210 9876543",
            email: "hello@dermaglow.gr",
            workingHours: JSON.stringify({ weekdays: "10:00 - 21:00", saturday: "Closed" }),
            services: JSON.stringify([
                { name: "Botox", price: "180€" },
                { name: "Laser Hair Removal", price: "60€" }
            ]),
            policies: JSON.stringify({ cancellation: "48h notice required" })
        }
    });
    console.log(`Created Clinic B: ${clinicB.name} (${clinicB.id})`);

    // 3. Create Patients for Clinic A
    await prisma.patient.create({
        data: {
            clinicId: clinicA.id,
            name: "Γιώργος Παπαδόπουλος",
            phone: "6971234567",
            appointments: {
                create: {
                    clinicId: clinicA.id,
                    startTime: new Date(),
                    endTime: new Date(new Date().getTime() + 60 * 60 * 1000),
                    reason: "Πονάει το δόντι μου",
                    status: "PENDING",
                    priority: "URGENT",
                    aiClassification: "Πόνος δοντιού (Επείγον)"
                }
            }
        }
    });

    // 4. Create Patients for Clinic B
    await prisma.patient.create({
        data: {
            clinicId: clinicB.id,
            name: "Μαρία Οικονόμου",
            phone: "6989876543",
            appointments: {
                create: {
                    clinicId: clinicB.id,
                    startTime: new Date(),
                    endTime: new Date(new Date().getTime() + 30 * 60 * 1000),
                    reason: "Θέλω ραντεβού για μπότοξ",
                    status: "CONFIRMED",
                    priority: "NORMAL",
                    aiClassification: "Αισθητική θεραπεία"
                }
            }
        }
    });

    console.log('✅ Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
