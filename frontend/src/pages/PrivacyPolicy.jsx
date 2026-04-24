import React from 'react';

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.75rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>{title}</h2>
        <div style={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.8 }}>{children}</div>
    </div>
);

const PrivacyPolicy = () => (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 2rem', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.5rem' }}>Πολιτική Απορρήτου</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Τελευταία ενημέρωση: Απρίλιος 2026 | MediaBlinkAI</p>
        </div>

        <div style={{ padding: '1rem 1.5rem', borderRadius: '12px', background: '#fef3c7', border: '1px solid #f59e0b', marginBottom: '2rem', fontSize: '0.85rem', color: '#92400e' }}>
            <strong>Σημαντική σημείωση:</strong> Η παρούσα πολιτική αφορά την επεξεργασία δεδομένων που πραγματοποιείται από την πλατφόρμα ClinicFlow της MediaBlinkAI για λογαριασμό ιατρείων-πελατών μας. Το ιατρείο που σας επικοινώνησε είναι ο Υπεύθυνος Επεξεργασίας των δεδομένων σας.
        </div>

        <Section title="1. Ποιοι είμαστε">
            <p>Η <strong>MediaBlinkAI</strong> (εφεξής «εμείς», «η εταιρεία») παρέχει την πλατφόρμα <strong>ClinicFlow</strong> — ένα σύστημα αυτοματοποιημένης ανάκτησης αναπάντητων κλήσεων για ιατρεία. Επικοινωνία: <a href="mailto:mediablink8@gmail.com" style={{ color: '#6366f1' }}>mediablink8@gmail.com</a></p>
        </Section>

        <Section title="2. Ποια δεδομένα συλλέγουμε">
            <p>Κατά την παροχή των υπηρεσιών μας σε ιατρεία, ενδέχεται να επεξεργαστούμε τα ακόλουθα δεδομένα ασθενών:</p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li><strong>Αριθμός τηλεφώνου</strong> — για την πραγματοποίηση της επανακλήσεως</li>
                <li><strong>Όνομα</strong> — εφόσον το παρέχετε κατά τη διάρκεια της κλήσης</li>
                <li><strong>Προτιμώμενη ημέρα και ώρα ραντεβού</strong> — εφόσον το παρέχετε</li>
                <li><strong>Περιεχόμενο SMS</strong> — εφόσον απαντήσετε σε μήνυμα του ιατρείου</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}><strong>Δεν πραγματοποιούμε ηχογράφηση κλήσεων.</strong></p>
        </Section>

        <Section title="3. Νομική βάση επεξεργασίας">
            <p>Η επεξεργασία των δεδομένων σας βασίζεται στο <strong>έννομο συμφέρον</strong> (άρθρο 6 παρ. 1 στ. ΓΚΠΔ) του ιατρείου να επικοινωνήσει μαζί σας σχετικά με αναπάντητη κλήση που πραγματοποιήσατε. Καλέσατε το ιατρείο, επομένως έχετε εύλογη προσδοκία επικοινωνίας εκ μέρους του.</p>
        </Section>

        <Section title="4. Πώς χρησιμοποιούμε τα δεδομένα σας">
            <ul style={{ paddingLeft: '1.5rem' }}>
                <li>Πραγματοποίηση αυτοματοποιημένης επανάκλησης για κλείσιμο ραντεβού</li>
                <li>Αποστολή SMS υπενθύμισης εάν δεν απαντήσετε στην κλήση</li>
                <li>Καταχώρηση ραντεβού στο σύστημα του ιατρείου</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Τα δεδομένα σας <strong>δεν χρησιμοποιούνται για marketing</strong>, δεν πωλούνται και δεν κοινοποιούνται σε τρίτους πέραν των αναγκαίων παρόχων υπηρεσιών.</p>
        </Section>

        <Section title="5. Αποδέκτες δεδομένων (Υπεπεξεργαστές)">
            <p>Για την παροχή των υπηρεσιών μας χρησιμοποιούμε τους ακόλουθους παρόχους:</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.85rem' }}>
                <thead>
                    <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Πάροχος</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Σκοπός</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Χώρα</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        ['Vapi', 'AI φωνητική κλήση επανάκτησης', 'ΗΠΑ'],
                        ['Vonage (Ericsson)', 'Αποστολή SMS', 'ΗΒ/ΗΠΑ'],
                        ['Supabase', 'Αποθήκευση δεδομένων', 'ΕΕ'],
                        ['Render', 'Φιλοξενία εφαρμογής', 'ΗΠΑ'],
                        ['n8n', 'Αυτοματοποίηση ροών εργασίας', 'ΕΕ/ΗΠΑ'],
                    ].map(([name, purpose, country]) => (
                        <tr key={name}>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}><strong>{name}</strong></td>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{purpose}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{country}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>Για παρόχους εκτός ΕΕ, η μεταφορά δεδομένων πραγματοποιείται βάσει Τυποποιημένων Συμβατικών Ρητρών (SCCs) ή άλλων κατάλληλων εγγυήσεων.</p>
        </Section>

        <Section title="6. Διάρκεια διατήρησης δεδομένων">
            <p>Τα δεδομένα επικοινωνίας (αριθμός τηλεφώνου, ιστορικό κλήσεων) διατηρούνται για <strong>12 μήνες</strong> από την τελευταία αλληλεπίδραση, εκτός εάν το ιατρείο ζητήσει νωρίτερη διαγραφή. Τα δεδομένα ραντεβού διατηρούνται σύμφωνα με τις υποχρεώσεις του ιατρείου.</p>
        </Section>

        <Section title="7. Τα δικαιώματά σας (ΓΚΠΔ)">
            <p>Έχετε δικαίωμα:</p>
            <ul style={{ paddingLeft: '1.5rem' }}>
                <li><strong>Πρόσβασης</strong> — να λάβετε αντίγραφο των δεδομένων σας</li>
                <li><strong>Διόρθωσης</strong> — να διορθώσετε ανακριβή δεδομένα</li>
                <li><strong>Διαγραφής</strong> — να ζητήσετε τη διαγραφή των δεδομένων σας</li>
                <li><strong>Εναντίωσης</strong> — να αντιταχθείτε στην επεξεργασία βάσει εννόμου συμφέροντος</li>
                <li><strong>Περιορισμού</strong> — να ζητήσετε περιορισμό της επεξεργασίας</li>
                <li><strong>Φορητότητας</strong> — να λάβετε τα δεδομένα σας σε δομημένη μορφή</li>
            </ul>
            <p style={{ marginTop: '0.75rem' }}>Για άσκηση των δικαιωμάτων σας, επικοινωνήστε με το ιατρείο που σας επικοινώνησε ή απευθείας με εμάς στο <a href="mailto:mediablink8@gmail.com" style={{ color: '#6366f1' }}>mediablink8@gmail.com</a>. Έχετε επίσης δικαίωμα καταγγελίας στην <strong>Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα</strong> (www.dpa.gr).</p>
        </Section>

        <Section title="8. Ασφάλεια δεδομένων">
            <p>Εφαρμόζουμε κατάλληλα τεχνικά και οργανωτικά μέτρα για την προστασία των δεδομένων σας, συμπεριλαμβανομένης της κρυπτογράφησης δεδομένων σε ηρεμία και κατά τη μεταφορά, ελέγχου πρόσβασης και τακτικών αξιολογήσεων ασφαλείας.</p>
        </Section>

        <Section title="9. Επικοινωνία">
            <p>MediaBlinkAI<br />Email: <a href="mailto:mediablink8@gmail.com" style={{ color: '#6366f1' }}>mediablink8@gmail.com</a></p>
        </Section>
    </div>
);

export default PrivacyPolicy;
