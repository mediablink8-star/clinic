const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COUNTRY = 'GR';

const FIXED_HOLIDAYS = [
  { month: 1, day: 1, name: 'Πρωτοχρονιά', nameEn: 'New Year\'s Day' },
  { month: 1, day: 6, name: 'Θεοφάνεια', nameEn: 'Epiphany' },
  { month: 3, day: 25, name: 'Εθνική Εορτή — Επανάσταση 1821', nameEn: 'Greek Independence Day' },
  { month: 5, day: 1, name: 'Πρωτομαγιά', nameEn: 'Labour Day' },
  { month: 8, day: 15, name: 'Κοίμηση της Θεοτόκου', nameEn: 'Assumption of Mary' },
  { month: 10, day: 28, name: 'Επέτειος του «Όχι»', nameEn: 'Ohi Day' },
  { month: 12, day: 25, name: 'Χριστούγεννα', nameEn: 'Christmas Day' },
  { month: 12, day: 26, name: 'Σύναξη Θεοτόκου', nameEn: 'Synaxis of the Theotokos' }
];

const ORTHODOX_EASTER = {
  2025: { month: 4, day: 20 },
  2026: { month: 4, day: 12 },
  2027: { month: 5, day: 2 },
  2028: { month: 4, day: 16 },
  2029: { month: 4, day: 8 },
  2030: { month: 4, day: 28 }
};

function addDays(year, month, day, days) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dateOnly(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function buildMovableHolidays(year) {
  const easter = ORTHODOX_EASTER[year];
  if (!easter) return [];
  return [
    { date: addDays(year, easter.month, easter.day, -48), name: 'Καθαρά Δευτέρα', nameEn: 'Clean Monday' },
    { date: addDays(year, easter.month, easter.day, -2), name: 'Μεγάλη Παρασκευή', nameEn: 'Good Friday' },
    { date: addDays(year, easter.month, easter.day, -1), name: 'Μεγάλο Σάββατο', nameEn: 'Holy Saturday' },
    { date: addDays(year, easter.month, easter.day, 1), name: 'Δευτέρα του Πάσχα', nameEn: 'Easter Monday' },
    { date: addDays(year, easter.month, easter.day, 50), name: 'Δευτέρα του Αγίου Πνεύματος', nameEn: 'Whit Monday' }
  ];
}

async function main() {
  const startYear = 2025;
  const endYear = 2029;
  const records = [];

  for (let year = startYear; year <= endYear; year++) {
    for (const h of FIXED_HOLIDAYS) {
      records.push({
        date: dateOnly(new Date(Date.UTC(year, h.month - 1, h.day))),
        name: h.name,
        nameEn: h.nameEn,
        country: COUNTRY,
        source: 'SEED'
      });
    }
    for (const m of buildMovableHolidays(year)) {
      records.push({
        date: dateOnly(m.date),
        name: m.name,
        nameEn: m.nameEn,
        country: COUNTRY,
        source: 'SEED'
      });
    }
  }

  let created = 0;
  let skipped = 0;
  for (const r of records) {
    const existing = await prisma.holiday.findUnique({
      where: { date_country: { date: r.date, country: r.country } }
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.holiday.create({ data: r });
    created++;
  }

  console.log(`[seed-holidays] Created ${created} holidays, skipped ${skipped} existing (${records.length} total).`);
  console.log(`[seed-holidays] Country: ${COUNTRY}, Years: ${startYear}-${endYear}.`);
}

main()
  .catch((err) => {
    console.error('[seed-holidays] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
