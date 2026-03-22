const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding local database...');

    // 1. Create Clinic
    const clinic = await prisma.clinic.upsert({
        where: { id: 'test-clinic' },
        update: {},
        create: {
            id: 'test-clinic',
            name: 'Local Health Clinic',
            location: 'Athens, Greece',
            phone: '2101234567',
            email: 'info@localclinic.com',
            workingHours: JSON.stringify({ "Monday": "09:00-17:00" }),
            services: JSON.stringify(["General Checkup"]),
            policies: JSON.stringify({ "Cancellation": "24h notice" }),
            messageCredits: 500,
            monthlyCreditLimit: 1000
        }
    });

    // 2. Create Admin User
    const passwordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@clinicflow.com' },
        update: { passwordHash },
        create: {
            email: 'admin@clinicflow.com',
            passwordHash,
            role: 'ADMIN',
            clinicId: clinic.id
        }
    });

    console.log('✅ Seeding complete!');
    console.log('Clinic ID:', clinic.id);
    console.log('Admin Email:', admin.email);
    console.log('Admin Password: admin123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
