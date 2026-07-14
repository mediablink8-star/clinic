import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  el: {
    translation: {
      clinicNotFound: 'Το ιατρείο δεν βρέθηκε.',
      noClinicId: 'Δεν βρέθηκε αναγνωριστικό ιατρείου. Παρακαλώ χρησιμοποιήστε τον σύνδεσμο που σας δόθηκε.',
      patientDetails: 'Στοιχεία Ασθενούς',
      selectAppointment: 'Επιλογή Ραντεβού',
      success: 'Επιτυχής Καταχώρηση!',
      fullName: 'Ονοματεπώνυμο',
      phone: 'Τηλέφωνο',
      email: 'Email (Προαιρετικά)',
      reason: 'Λόγος Επίσκεψης',
      continue: 'Συνέχεια',
      back: 'Πίσω',
      bookAppointment: 'Επιβεβαίωση Ραντεβού',
      newBooking: 'Νέα Κράτηση',
      loading: 'Φόρτωση...',
      slotsLoading: 'Αναζήτηση slots...',
      noSlots: 'Δεν υπάρχουν διαθέσιμες ώρες για αυτή την ημέρα.',
      tryAnotherDate: 'Δοκιμάστε άλλη ημερομηνία ή καλέστε μας για ραντεβού εκτός ωραρίου.',
      slotTaken: 'Η συγκεκριμένη ώρα μόλις κλείστηκε από άλλον ασθενή. Παρακαλώ επιλέξτε μια άλλη ώρα.',
      validationError: 'Παρακαλώ ελέγξτε τα στοιχεία σας και δοκιμάστε ξανά.',
      bookingFailed: 'Η κράτηση απέτυχε. Παρακαλώ δοκιμάστε ξανά.',
      requiredFields: 'Παρακαλώ συμπληρώστε σωστά:',
      minNameLength: 'Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες',
      minPhoneLength: 'Το τηλέφωνο πρέπει να έχει τουλάχιστον 10 ψηφία',
      invalidEmail: 'Μη έγκυρη διεύθυνση email',
      selectDateTime: 'Παρακαλώ επιλέξτε ημερομηνία και ώρα.',
      confirmationSent: 'Θα λάβετε σύντομα μήνυμα επιβεβαίωσης.',
      newBooking: 'Νέα Κράτηση',
      poweredBy: 'Powered by AI-first Clinic Management • Secure & Encrypted',
      selectDoctor: 'Επιλογή Γιατρού',
      anyDoctor: 'Οποιοσδήποτε',
      date: 'Ημερομηνία',
      availableTimes: 'Διαθέσιμες Ώρες',
      selectDateFirst: 'Παρακαλώ επιλέξτε ημερομηνία πρώτα',
      recaptchaVerify: 'Επαλήθευση ασφαλείας...',
      verified: 'Επαλήθευση ολόκληρη',
      securityCheck: 'Έλεγχος ασφαλείας',
      downloadCalendar: 'Προσθήκη στο ημερολόγιο',
      selectDateFirst: 'Παρακαλώ επιλέξτε ημερομηνία πρώτα',
    }
  },
  en: {
    translation: {
      clinicNotFound: 'Clinic not found.',
      noClinicId: 'Clinic ID not found. Please use the link provided to you.',
      patientDetails: 'Patient Details',
      selectAppointment: 'Select Appointment',
      success: 'Booking Confirmed!',
      fullName: 'Full Name',
      phone: 'Phone',
      email: 'Email (Optional)',
      reason: 'Reason for Visit',
      continue: 'Continue',
      back: 'Back',
      bookAppointment: 'Confirm Appointment',
      newBooking: 'New Booking',
      loading: 'Loading...',
      slotsLoading: 'Finding available slots...',
      noSlots: 'No available slots for this date.',
      tryAnotherDate: 'Try another date or call us for after-hours appointments.',
      slotTaken: 'This time slot was just booked by another patient. Please select another time.',
      validationError: 'Please check your details and try again.',
      bookingFailed: 'Booking failed. Please try again.',
      requiredFields: 'Please fill in correctly:',
      minNameLength: 'Name must be at least 2 characters',
      minPhoneLength: 'Phone must be at least 10 digits',
      invalidEmail: 'Invalid email address',
      selectDateTime: 'Please select date and time.',
      confirmationSent: 'You will receive a confirmation message shortly.',
      newBooking: 'New Booking',
      poweredBy: 'Powered by AI-first Clinic Management • Secure & Encrypted',
      selectDoctor: 'Select Doctor',
      anyDoctor: 'Any Doctor',
      date: 'Date',
      availableTimes: 'Available Times',
      selectDateFirst: 'Please select a date first',
      recaptchaVerify: 'Verifying security...',
      verified: 'Verification complete',
      securityCheck: 'Security Check',
      downloadCalendar: 'Add to Calendar',
      selectDateFirst: 'Please select a date first',
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'el',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;