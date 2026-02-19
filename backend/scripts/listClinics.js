const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function list() {
    try {
        console.log('Querying clinics...');
        const clinics = await prisma.clinic.findMany({
            select: { id: true, name: true, email: true, password: true }
        });
        console.log('Clinics found:', clinics.length);
        console.log(JSON.stringify(clinics, null, 2));
    } catch (e) {
        console.error('❌ Error listing clinics:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
list();
