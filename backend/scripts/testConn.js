const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    console.log('Testing connection...');
    try {
        await prisma.$connect();
        console.log('✅ Connection Successful!');

        const tables = await prisma.$queryRaw`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name
        `;
        console.log('All tables found:', JSON.stringify(tables, null, 2));

        const appointmentCheck = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'Appointment'
            )
        `;
        console.log('Appointment table exists (exact match "Appointment"):', appointmentCheck);

        const types = await prisma.$queryRaw`
            SELECT n.nspname as schema, t.typname as type 
            FROM pg_type t 
            JOIN pg_namespace n ON n.oid = t.typnamespace 
            WHERE n.nspname = 'public'
        `;
        console.log('Public types found:', JSON.stringify(types, null, 2));

        const appointmentStatusCheck = await prisma.$queryRaw`
            SELECT n.nspname as schema, t.typname as type 
            FROM pg_type t 
            JOIN pg_namespace n ON n.oid = t.typnamespace 
            WHERE n.nspname = 'public' AND t.typname = 'AppointmentStatus'
        `;
        console.log('AppointmentStatus type exists:', appointmentStatusCheck);

    } catch (e) {
        console.error('❌ Error during check:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

test();
