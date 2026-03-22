/**
 * demoClinic.js
 * Simulates a realistic clinic day for demo/presentation purposes.
 * Run with: node scripts/demoClinic.js
 *
 * What it does:
 *  1. Finds the existing demo clinic (or the first clinic in DB)
 *  2. Creates 6 realistic patients
 *  3. Creates appointments across today (mix of CONFIRMED, PENDING, URGENT)
 *  4. Creates missed calls in various recovery stages
 *  5. Creates message logs (SMS sent)
 *  6. Creates feedback entries with sentiment
 *  7. Prints a summary
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────

const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000);
const minutesAgo   = (m) => new Date(Date.now() - m * 60 * 1000);
const hoursAgo     = (h) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo      = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

// ── demo data ─────────────────────────────────────────────────────────────────

const PATIENTS = [
    { name: 'Γιώργος Παπαδόπουλος',  phone: '6912345601', email: 'gpapad@example.com' },
    { name: 'Μαρία Κωνσταντίνου',    phone: '6923456702', email: 'mkons@example.com'  },
    { name: 'Νίκος Αλεξίου',         phone: '6934567803', email: 'nalexiou@example.com'},
    { name: 'Ελένη Δημητρίου',       phone: '6945678904', email: 'edimitr@example.com' },
    { name: 'Κώστας Σταματίου',      phone: '6956789005', email: 'kstam@example.com'  },
    { name: 'Σοφία Αντωνίου',        phone: '6967890106', email: 'santoni@example.com' },
];

async function main() {
    console.log('\n🏥  ClinicFlow — Demo Clinic Simulation\n');

    // ── 1. Find clinic ────────────────────────────────────────────────────────
    let clinic = await prisma.clinic.findFirst({
        where: { email: 'admin@clinicflow.com' }
    });
    if (!clinic) clinic = await prisma.clinic.findFirst();
    if (!clinic) {
        console.error('❌  No clinic found. Run the backend seed first.');
        process.exit(1);
    }
    console.log(`✅  Using clinic: "${clinic.name}" (${clinic.id})`);

    // ── 2. Upsert patients ────────────────────────────────────────────────────
    console.log('\n👥  Creating patients...');
    const createdPatients = [];
    for (const p of PATIENTS) {
        const patient = await prisma.patient.upsert({
            where: { clinicId_phone: { clinicId: clinic.id, phone: p.phone } },
            update: { name: p.name, email: p.email },
            create: { ...p, clinicId: clinic.id }
        });
        createdPatients.push(patient);
        console.log(`   • ${patient.name} (${patient.phone})`);
    }

    // ── 3. Appointments ───────────────────────────────────────────────────────
    console.log('\n📅  Creating appointments...');

    const apptDefs = [
        {
            patient: createdPatients[0],
            startTime: hoursFromNow(-2),
            endTime:   hoursFromNow(-1),
            reason: 'Πονάει το δόντι μου έντονα από χθες',
            status: 'COMPLETED',
            priority: 'URGENT',
            aiClassification: 'Επείγον — Οδονταλγία',
        },
        {
            patient: createdPatients[1],
            startTime: hoursFromNow(-0.5),
            endTime:   hoursFromNow(0.5),
            reason: 'Τακτικός καθαρισμός',
            status: 'CONFIRMED',
            priority: 'NORMAL',
            aiClassification: 'Προγραμματισμένος καθαρισμός',
        },
        {
            patient: createdPatients[2],
            startTime: hoursFromNow(1),
            endTime:   hoursFromNow(2),
            reason: 'Έσπασε το δόντι μου',
            status: 'CONFIRMED',
            priority: 'URGENT',
            aiClassification: 'Επείγον — Κατάγμα δοντιού',
        },
        {
            patient: createdPatients[3],
            startTime: hoursFromNow(2.5),
            endTime:   hoursFromNow(3.5),
            reason: 'Λεύκανση δοντιών',
            status: 'PENDING',
            priority: 'NORMAL',
            aiClassification: 'Αισθητική — Λεύκανση',
        },
        {
            patient: createdPatients[4],
            startTime: hoursFromNow(4),
            endTime:   hoursFromNow(5),
            reason: 'Εμφύτευμα — συνέχεια θεραπείας',
            status: 'CONFIRMED',
            priority: 'NORMAL',
            aiClassification: 'Εμφύτευμα — Φάση 2',
        },
        {
            patient: createdPatients[5],
            startTime: daysAgo(1),
            endTime:   new Date(daysAgo(1).getTime() + 60 * 60 * 1000),
            reason: 'Ορθοδοντικός έλεγχος',
            status: 'NO_SHOW',
            priority: 'NORMAL',
            aiClassification: 'Ορθοδοντικός έλεγχος',
        },
    ];

    const createdAppts = [];
    for (const def of apptDefs) {
        const existing = await prisma.appointment.findFirst({
            where: {
                clinicId: clinic.id,
                patientId: def.patient.id,
                startTime: def.startTime,
            }
        });
        if (existing) {
            createdAppts.push(existing);
            console.log(`   ↩  Skipped (exists): ${def.patient.name}`);
            continue;
        }
        const appt = await prisma.appointment.create({
            data: {
                clinicId: clinic.id,
                patientId: def.patient.id,
                startTime: def.startTime,
                endTime: def.endTime,
                reason: def.reason,
                status: def.status,
                priority: def.priority,
                aiClassification: def.aiClassification,
            }
        });
        createdAppts.push(appt);
        console.log(`   • ${def.patient.name} — ${def.status} (${def.priority})`);
    }

    // ── 4. Missed calls / Recovery pipeline ──────────────────────────────────
    console.log('\n📞  Simulating missed calls & recovery pipeline...');

    const missedCallDefs = [
        {
            patient: createdPatients[5], // Sofia — no-show
            fromNumber: createdPatients[5].phone,
            status: 'RECOVERED',
            estimatedRevenue: 120,
            createdAt: hoursAgo(5),
            recoveredAt: hoursAgo(2),
        },
        {
            patient: createdPatients[0],
            fromNumber: createdPatients[0].phone,
            status: 'RECOVERING',
            estimatedRevenue: 80,
            createdAt: hoursAgo(1),
        },
        {
            patient: null,
            fromNumber: '+30697XXXXXXX',
            status: 'DETECTED',
            estimatedRevenue: 150,
            createdAt: minutesAgo(20),
        },
        {
            patient: null,
            fromNumber: '+30693XXXXXXX',
            status: 'RECOVERING',
            estimatedRevenue: 200,
            createdAt: minutesAgo(45),
        },
        {
            patient: createdPatients[2],
            fromNumber: createdPatients[2].phone,
            status: 'RECOVERED',
            estimatedRevenue: 350,
            createdAt: daysAgo(1),
            recoveredAt: hoursAgo(20),
        },
        {
            patient: null,
            fromNumber: '+30694XXXXXXX',
            status: 'LOST',
            estimatedRevenue: 80,
            createdAt: daysAgo(2),
        },
    ];

    for (const mc of missedCallDefs) {
        const existing = await prisma.missedCall.findFirst({
            where: { clinicId: clinic.id, fromNumber: mc.fromNumber, status: mc.status }
        });
        if (existing) {
            console.log(`   ↩  Skipped (exists): ${mc.fromNumber} — ${mc.status}`);
            continue;
        }
        await prisma.missedCall.create({
            data: {
                clinicId: clinic.id,
                fromNumber: mc.fromNumber,
                patientId: mc.patient?.id || null,
                status: mc.status,
                estimatedRevenue: mc.estimatedRevenue,
                createdAt: mc.createdAt,
                recoveredAt: mc.recoveredAt || null,
                updatedAt: mc.recoveredAt || mc.createdAt,
            }
        });
        console.log(`   • ${mc.fromNumber} — ${mc.status} (€${mc.estimatedRevenue})`);
    }

    // ── 5. Message logs ───────────────────────────────────────────────────────
    console.log('\n💬  Creating message logs...');

    const msgLogs = [
        { type: 'SMS', status: 'SENT',   timestamp: minutesAgo(5)  },
        { type: 'SMS', status: 'SENT',   timestamp: minutesAgo(18) },
        { type: 'SMS', status: 'SENT',   timestamp: minutesAgo(47) },
        { type: 'SMS', status: 'FAILED', timestamp: hoursAgo(1)    },
        { type: 'SMS', status: 'SENT',   timestamp: hoursAgo(2)    },
        { type: 'SMS', status: 'SENT',   timestamp: hoursAgo(3)    },
    ];

    for (const log of msgLogs) {
        await prisma.messageLog.create({
            data: { clinicId: clinic.id, ...log }
        });
    }
    console.log(`   • Created ${msgLogs.length} message log entries`);

    // ── 6. Feedback / Sentiment ───────────────────────────────────────────────
    console.log('\n⭐  Creating patient feedback...');

    const feedbackDefs = [
        { apptIdx: 0, rating: 5, comment: 'Εξαιρετική εξυπηρέτηση, πολύ γρήγορη αντιμετώπιση!', sentiment: 'POSITIVE' },
        { apptIdx: 1, rating: 4, comment: 'Πολύ καλός καθαρισμός, ευχαριστημένη.', sentiment: 'POSITIVE' },
        { apptIdx: 4, rating: 3, comment: 'Η αναμονή ήταν λίγο μεγάλη.', sentiment: 'NEUTRAL' },
    ];

    for (const fb of feedbackDefs) {
        const appt = createdAppts[fb.apptIdx];
        if (!appt) continue;
        const existing = await prisma.feedback.findFirst({
            where: { appointmentId: appt.id }
        });
        if (existing) {
            console.log(`   ↩  Skipped feedback for appt ${appt.id}`);
            continue;
        }
        await prisma.feedback.create({
            data: {
                appointmentId: appt.id,
                rating: fb.rating,
                comment: fb.comment,
                sentiment: fb.sentiment,
            }
        });
        console.log(`   • ${fb.sentiment} — "${fb.comment.slice(0, 40)}..."`);
    }

    // ── 7. Notifications ──────────────────────────────────────────────────────
    console.log('\n🔔  Creating notifications...');

    const notifDefs = [
        {
            appointmentId: createdAppts[2]?.id,
            type: 'REMINDER',
            message: `Υπενθύμιση ραντεβού: ${createdPatients[2].name} σε 1 ώρα`,
            scheduledFor: hoursFromNow(1),
            status: 'SCHEDULED',
        },
        {
            appointmentId: createdAppts[5]?.id,
            type: 'NO_SHOW_ALERT',
            message: `Ο/Η ${createdPatients[5].name} δεν εμφανίστηκε στο ραντεβού`,
            scheduledFor: daysAgo(1),
            sentAt: daysAgo(1),
            status: 'SENT',
        },
    ];

    for (const n of notifDefs) {
        if (!n.appointmentId) continue;
        const existing = await prisma.notification.findFirst({
            where: { clinicId: clinic.id, appointmentId: n.appointmentId, type: n.type }
        });
        if (existing) {
            console.log(`   ↩  Skipped notification (exists)`);
            continue;
        }
        await prisma.notification.create({
            data: { clinicId: clinic.id, ...n }
        });
        console.log(`   • ${n.type}: ${n.message.slice(0, 50)}`);
    }

    // ── 8. Summary ────────────────────────────────────────────────────────────
    const [totalPatients, totalAppts, totalMissed, totalRecovered, totalRevenue] = await Promise.all([
        prisma.patient.count({ where: { clinicId: clinic.id } }),
        prisma.appointment.count({ where: { clinicId: clinic.id } }),
        prisma.missedCall.count({ where: { clinicId: clinic.id } }),
        prisma.missedCall.count({ where: { clinicId: clinic.id, status: 'RECOVERED' } }),
        prisma.missedCall.aggregate({ where: { clinicId: clinic.id, status: 'RECOVERED' }, _sum: { estimatedRevenue: true } }),
    ]);

    console.log('\n─────────────────────────────────────────');
    console.log('📊  Demo Summary');
    console.log('─────────────────────────────────────────');
    console.log(`   Clinic       : ${clinic.name}`);
    console.log(`   Patients     : ${totalPatients}`);
    console.log(`   Appointments : ${totalAppts}`);
    console.log(`   Missed Calls : ${totalMissed}`);
    console.log(`   Recovered    : ${totalRecovered}`);
    console.log(`   Revenue      : €${totalRevenue._sum.estimatedRevenue || 0}`);
    console.log('─────────────────────────────────────────');
    console.log('\n✅  Demo data ready. Open http://localhost:5173 to see it live.\n');
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
