const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('💎 Seeding Extensive Premium SaaS Mock Data...');

    // 0. Clean database in correct order
    await prisma.feedback.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.messageLog.deleteMany();
    await prisma.missedCall.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.clinic.deleteMany();

    // 1. Create Premium Clinic with Rich Settings
    const clinic = await prisma.clinic.create({
        data: {
            id: 'premium-clinic',
            name: "Advanced Dental Care Athens",
            location: "Leoforos Vasilissis Sofias 102, Athens",
            phone: "+30 210 555 1234",
            email: "contact@advanceddental.gr",
            workingHours: JSON.stringify({ 
                mon: "09:00 - 21:00", 
                tue: "09:00 - 21:00", 
                wed: "09:00 - 21:00", 
                thu: "09:00 - 21:00", 
                fri: "09:00 - 20:00", 
                sat: "10:00 - 15:00", 
                sun: "Closed" 
            }),
            services: JSON.stringify([
                { id: 1, name: "Καθαρισμός & Φθορίωση", price: "60€", duration: "45 min" },
                { id: 2, name: "Λεύκανση Laser", price: "250€", duration: "60 min" },
                { id: 3, name: "Εμφύτευμα (Συμβουλευτική)", price: "40€", duration: "30 min" },
                { id: 4, name: "Ορθοδοντική Θεραπεία", price: "Ανά περίπτωση", duration: "45 min" },
                { id: 5, name: "Σφράγισμα", price: "70€", duration: "45 min" }
            ]),
            policies: JSON.stringify({ 
                cancellation: "Ακύρωση τουλάχιστον 24 ώρες πριν το ραντεβού.",
                reschedule: "Δυνατότητα αλλαγής έως 2 φορές.",
                emergency: "Άμεση εξυπηρέτηση για επείγοντα περιστατικά (πόνος)."
            }),
            aiConfig: JSON.stringify({ 
                active: true, 
                tone: "Professional & Empathetic", 
                persona: "Smart Medical Assistant",
                welcomeMessage: "Γεια σας! Σας καλούμε από την Advanced Dental Care. Είχατε μια αναπάντητη κλήση;",
                autoRecovery: true,
                valuePerLead: 150
            }),
            apiKeys: JSON.stringify({ 
                twilioStatus: "connected", 
                googleCalendar: "synced",
                stripe: "active"
            }),
            webhookUrl: "https://n8n.advanceddental.gr/webhook/clinic-recovery",
            messageCredits: 850,
            monthlyCreditLimit: 1000
        }
    });

    // 2. Create Staff Users (Password: password123)
    const users = [
        {
            email: "staff@advanceddental.gr",
            passwordHash: "$2b$10$RZNoPzQrj7REOurQrOB0LO4zXnHH.KRbnoQNEBVhaf9g.8bKsdW2u",
            role: "STAFF",
            clinicId: clinic.id
        },
        {
            email: "admin@clinicflow.com",
            passwordHash: "$2b$10$RZNoPzQrj7REOurQrOB0LO4zXnHH.KRbnoQNEBVhaf9g.8bKsdW2u",
            role: "ADMIN",
            clinicId: clinic.id
        }
    ];

    for (const u of users) {
        await prisma.user.create({ data: u });
    }

    // 3. Create 15 Realistic Patients
    const patientData = [
        { name: "Νίκος Παπαδόπουλος", phone: "6971111111", email: "nikos@gmail.com" },
        { name: "Ελένη Δημητρίου", phone: "6972222222", email: "eleni@outlook.com" },
        { name: "Γιάννης Κωνσταντίνου", phone: "6973333333", email: "giannis@company.gr" },
        { name: "Μαρία Σιδέρη", phone: "6974444444", email: "maria@gmail.com" },
        { name: "Κώστας Αντωνίου", phone: "6975555555", email: "kostas@gmail.com" },
        { name: "Άννα Μανώλη", phone: "6976666666", email: "anna@example.gr" },
        { name: "Δημήτρης Ράπτης", phone: "6977777777", email: "dim@gmail.com" },
        { name: "Χριστίνα Λάμπρου", phone: "6978888888", email: "christina@example.com" },
        { name: "Στέλιος Βασιλείου", phone: "6979999999", email: "stelios@bas.gr" },
        { name: "Κατερίνα Βέλλιου", phone: "6970000000", email: "kat@outlook.com" },
        { name: "Πέτρος Ιωάννου", phone: "6971112222", email: "petros@gmail.com" },
        { name: "Σοφία Παππά", phone: "6972223333", email: "sofia@gmail.com" },
        { name: "Ανδρέας Γεωργίου", phone: "6973334444", email: "andreas@gmail.com" },
        { name: "Ιωάννα Φωτίου", phone: "6974445555", email: "ioanna@gmail.com" },
        { name: "Γιώργος Νικολάου", phone: "6975556666", email: "giorgos@gmail.com" }
    ];

    const patients = [];
    for (const p of patientData) {
        const patient = await prisma.patient.create({
            data: { ...p, clinicId: clinic.id }
        });
        patients.push(patient);
    }

    // 4. Create Appointments
    const today = new Date();
    today.setHours(0,0,0,0);

    const appointmentData = [
        { patientId: patients[0].id, startTime: new Date(today.getTime() + 10 * 3600000), status: "COMPLETED", reason: "Καθαρισμός" },
        { patientId: patients[1].id, startTime: new Date(today.getTime() + 11 * 3600000), status: "PENDING", reason: "Λεύκανση" }, // Needs Attention
        { patientId: patients[2].id, startTime: new Date(today.getTime() + 15 * 3600000), status: "CONFIRMED", reason: "Έκτακτο - Πόνος", priority: "URGENT" },
        { patientId: patients[3].id, startTime: new Date(today.getTime() + 17 * 3600000), status: "CONFIRMED", reason: "Επανέλεγχος" },
        { patientId: patients[4].id, startTime: new Date(today.getTime() + 9 * 3600000), status: "CONFIRMED", reason: "Σφράγισμα" },
        // Upcoming
        { patientId: patients[5].id, startTime: new Date(today.getTime() + 24 * 3600000 + 10 * 3600000), status: "PENDING", reason: "Λεύκανση" },
        { patientId: patients[6].id, startTime: new Date(today.getTime() + 48 * 3600000 + 11 * 3600000), status: "CONFIRMED", reason: "Καθαρισμός" }
    ];

    for (const a of appointmentData) {
        await prisma.appointment.create({
            data: {
                ...a,
                clinicId: clinic.id,
                endTime: new Date(a.startTime.getTime() + 3600000)
            }
        });
    }

    // 5. Create Missed Calls & AI Logs
    const missedCalls = [
        {
            clinicId: clinic.id,
            fromNumber: patients[7].phone,
            patientId: patients[7].id,
            status: "RECOVERING", // Waiting reply
            aiConversation: JSON.stringify([{ role: "ai", text: "Γεια σας!" }, { role: "user", text: "Θέλω τιμή" }]),
            createdAt: new Date(Date.now() - 20 * 60000)
        },
        {
            clinicId: clinic.id,
            fromNumber: patients[8].phone,
            patientId: patients[8].id,
            status: "RECOVERING", // Waiting reply
            aiConversation: JSON.stringify([{ role: "ai", text: "Θέλετε ραντεβού;" }, { role: "user", text: "Ναι για αύριο" }]),
            createdAt: new Date(Date.now() - 5 * 60000)
        },
        {
            clinicId: clinic.id,
            fromNumber: "+306912345678",
            status: "RECOVERED",
            estimatedRevenue: 150.0,
            recoveredAt: new Date(Date.now() - 3600000 * 2),
            createdAt: new Date(Date.now() - 3600000 * 4)
        },
        {
            clinicId: clinic.id,
            fromNumber: "+306900001111",
            status: "DETECTED",
            createdAt: new Date(Date.now() - 10 * 60000)
        },
        {
            clinicId: clinic.id,
            fromNumber: "+306900002222",
            status: "LOST",
            createdAt: new Date(Date.now() - 3600000 * 48)
        }
    ];

    for (const mc of missedCalls) {
        await prisma.missedCall.create({ data: mc });
    }

    // 6. Create Message Logs (Usage Tracking)
    for (let i = 0; i < 40; i++) {
        await prisma.messageLog.create({
            data: {
                clinicId: clinic.id,
                type: i % 3 === 0 ? "WHATSAPP" : "SMS",
                status: "SENT",
                cost: 1,
                timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 3600000) // Random in last 30 days
            }
        });
    }

    // 7. Create Audit Logs (System History)
    const auditData = [
        { action: "AI_RECOVERY_STARTED", entity: "MISSED_CALL", details: "Auto-reply sent to 6976666666" },
        { action: "APPOINTMENT_CONFIRMED", entity: "APPOINTMENT", details: "Patient confirmed via SMS" },
        { action: "SETTINGS_UPDATED", entity: "CLINIC", details: "Working hours modified by Admin" },
        { action: "PATIENT_CREATED", entity: "PATIENT", details: "New patient registration" },
        { action: "SMS_CAMPAIGN_SENT", entity: "MARKETING", details: "Recall campaign for cleanings" }
    ];

    for (const ad of auditData) {
        await prisma.auditLog.create({
            data: { ...ad, clinicId: clinic.id, createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 3600000) }
        });
    }

    // 8. Create Feedback (Sentiment Analysis Demo)
    const completedApt = await prisma.appointment.findFirst({ where: { status: 'COMPLETED' } });
    if (completedApt) {
        await prisma.feedback.create({
            data: {
                appointmentId: completedApt.id,
                rating: 5,
                comment: "Εξαιρετική εξυπηρέτηση και το AI βοηθάει πολύ στα ραντεβού!",
                sentiment: "POSITIVE"
            }
        });
    }

    // 9. Create Notifications
    await prisma.notification.create({
        data: {
            clinicId: clinic.id,
            type: "REMINDER",
            message: "Υπενθύμιση για το ραντεβού της Ελένης Δημητρίου",
            scheduledFor: new Date(Date.now() + 3600000 * 2)
        }
    });

    console.log('✅ Comprehensive seeding finished successfully!');
    console.log('🔑 Demo Login: staff@advanceddental.gr / password123');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
