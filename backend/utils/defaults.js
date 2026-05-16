const DEFAULT_WORKING_HOURS = {
    'Δευτέρα': '09:00-20:00',
    'Τρίτη': '09:00-20:00',
    'Τετάρτη': '09:00-20:00',
    'Πέμπτη': '09:00-20:00',
    'Παρασκευή': '09:00-20:00',
    'Σάββατο': '10:00-14:00',
    'Κυριακή': 'Closed'
};

const DEFAULT_SERVICES = [
    { id: '1', name: 'Γενική Εξέταση', duration: 30, price: 50 },
    { id: '2', name: 'Επείγον Περιστατικό', duration: 45, price: 70 },
    { id: '3', name: 'Καθαρισμός', duration: 45, price: 60 },
    { id: '4', name: 'Follow-up', duration: 15, price: 30 }
];

const DEFAULT_POLICIES = {
    cancellationNotice: 24,
    reminderHours: 24,
    autoConfirmation: true
};

const DEFAULT_AI_CONFIG = {
    tone: 'Professional',
    language: 'el',
    languages: ['Ελληνικά'],
    autoReplyEnabled: true,
    avgAppointmentValue: 80,
    services: 'Γενική Εξέταση, Καθαρισμός, Εμφυτεύματα, Λεύκανση',
    workingHours: DEFAULT_WORKING_HOURS,
    smsInitial: 'Γεια 👋 χάσαμε την κλήση σας στο {clinic_name}.\nΚλείστε ραντεβού εδώ: {booking_link}',
    smsBookingConfirm: 'Τέλεια 👍 Σας κλείσαμε για {day} στις {time}.\nΑν χρειαστείτε κάτι άλλο, απαντήστε εδώ 😊',
    smsCallbackConfirm: 'Εντάξει! Θα σας καλέσουμε σύντομα 📞 Ευχαριστούμε!',
    smsUnknown: 'Απαντήστε 1, 2 ή 3 για να σας βοηθήσω 👍\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση',
    smsFollowup1: 'Μόλις ελέγχαμε — χρειάζεστε βοήθεια με ραντεβού ή έχετε ερώτηση; 😊\n1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση',
    smsFollowup2: 'Έχουμε περιορισμένη διαθεσιμότητα σήμερα — θέλετε να κλείσουμε κάτι για εσάς; 📅'
};

const INITIAL_CREDITS = 100;
const INITIAL_MONTHLY_LIMIT = 100;
const INITIAL_DAILY_CAP = 50;

module.exports = {
    DEFAULT_WORKING_HOURS,
    DEFAULT_SERVICES,
    DEFAULT_POLICIES,
    DEFAULT_AI_CONFIG,
    INITIAL_CREDITS,
    INITIAL_MONTHLY_LIMIT,
    INITIAL_DAILY_CAP
};
