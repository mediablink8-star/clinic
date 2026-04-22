import React from 'react';

const Section = ({ num, title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.75rem' }}>Άρθρο {num}. {title}</h2>
        <div style={{ fontSize: '0.88rem', color: '#374151', lineHeight: 1.8 }}>{children}</div>
    </div>
);

const DataProcessingAgreement = () => (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '3rem 2rem', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', marginBottom: '0.5rem' }}>Σύμβαση Επεξεργασίας Δεδομένων (DPA)</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Σύμφωνα με το Άρθρο 28 του Γενικού Κανονισμού Προστασίας Δεδομένων (ΓΚΠΔ) 2016/679</p>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>Τελευταία ενημέρωση: Απρίλιος 2026</p>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderRadius: '12px', background: '#f0f9ff', border: '1px solid #0891b2', marginBottom: '2rem', fontSize: '0.85rem', color: '#0c4a6e' }}>
            <strong>Μεταξύ:</strong><br />
            <strong>Εκτελών την Επεξεργασία:</strong> MediaBlinkAI, email: mediablink8@gmail.com («Εκτελών»)<br />
            <strong>Υπεύθυνος Επεξεργασίας:</strong> Το ιατρείο που έχει εγγραφεί στην πλατφόρμα ClinicFlow («Υπεύθυνος»)
        </div>

        <Section num="1" title="Αντικείμενο και διάρκεια">
            <p>Η παρούσα σύμβαση ρυθμίζει την επεξεργασία δεδομένων προσωπικού χαρακτήρα που πραγματοποιεί ο Εκτελών για λογαριασμό του Υπευθύνου στο πλαίσιο παροχής της υπηρεσίας ClinicFlow. Η σύμβαση ισχύει καθ' όλη τη διάρκεια της συνδρομής του Υπευθύνου.</p>
        </Section>

        <Section num="2" title="Φύση και σκοπός της επεξεργασίας">
            <p>Ο Εκτελών επεξεργάζεται δεδομένα για τους ακόλουθους σκοπούς:</p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Αυτοματοποιημένη επανάκληση ασθενών που δεν απαντήθηκαν</li>
                <li>Αποστολή SMS υπενθύμισης</li>
                <li>Καταχώρηση ραντεβού στο σύστημα του Υπευθύνου</li>
                <li>Παροχή αναλυτικών στοιχείων ανάκτησης στον Υπεύθυνο</li>
            </ul>
        </Section>

        <Section num="3" title="Κατηγορίες δεδομένων και υποκειμένων">
            <p><strong>Κατηγορίες υποκειμένων:</strong> Ασθενείς και δυνητικοί ασθενείς του Υπευθύνου.</p>
            <p style={{ marginTop: '0.5rem' }}><strong>Κατηγορίες δεδομένων:</strong> Αριθμός τηλεφώνου, όνομα (εφόσον παρέχεται), προτιμώμενη ημέρα/ώρα ραντεβού, περιεχόμενο SMS αλληλεπίδρασης.</p>
            <p style={{ marginTop: '0.5rem' }}><strong>Ειδικές κατηγορίες:</strong> Δεν επεξεργαζόμαστε δεδομένα υγείας, διαγνώσεις ή ιατρικό ιστορικό.</p>
        </Section>

        <Section num="4" title="Υποχρεώσεις Εκτελούντος">
            <p>Ο Εκτελών υποχρεούται να:</p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Επεξεργάζεται δεδομένα αποκλειστικά κατ' εντολή του Υπευθύνου</li>
                <li>Διασφαλίζει εμπιστευτικότητα από το προσωπικό που έχει πρόσβαση</li>
                <li>Εφαρμόζει κατάλληλα τεχνικά και οργανωτικά μέτρα ασφαλείας (κρυπτογράφηση, έλεγχος πρόσβασης)</li>
                <li>Συνδράμει τον Υπεύθυνο στην εκπλήρωση αιτημάτων άσκησης δικαιωμάτων υποκειμένων</li>
                <li>Διαγράφει ή επιστρέφει δεδομένα κατά τη λήξη της σύμβασης</li>
                <li>Παρέχει κάθε αναγκαία πληροφορία για απόδειξη συμμόρφωσης</li>
                <li>Γνωστοποιεί παραβιάσεις δεδομένων εντός 72 ωρών από τη γνώση τους</li>
            </ul>
        </Section>

        <Section num="5" title="Υπεπεξεργαστές">
            <p>Ο Εκτελών χρησιμοποιεί τους ακόλουθους εγκεκριμένους υπεπεξεργαστές:</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                <thead>
                    <tr style={{ background: '#f8fafc' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Υπεπεξεργαστής</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Σκοπός</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Χώρα</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #e2e8f0' }}>Βάση μεταφοράς</th>
                    </tr>
                </thead>
                <tbody>
                    {[
                        ['Bland AI', 'AI φωνητική κλήση', 'ΗΠΑ', 'SCCs'],
                        ['Vonage', 'Αποστολή SMS', 'ΗΒ/ΗΠΑ', 'SCCs / Adequacy'],
                        ['Supabase', 'Βάση δεδομένων', 'ΕΕ', 'Εντός ΕΕ'],
                        ['Render', 'Φιλοξενία', 'ΗΠΑ', 'SCCs'],
                        ['n8n Cloud', 'Αυτοματοποίηση', 'ΕΕ/ΗΠΑ', 'SCCs'],
                    ].map(([name, purpose, country, basis]) => (
                        <tr key={name}>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}><strong>{name}</strong></td>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{purpose}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{country}</td>
                            <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{basis}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#64748b' }}>Ο Εκτελών θα ενημερώνει τον Υπεύθυνο για τυχόν αλλαγές στους υπεπεξεργαστές με 30 ημέρες προειδοποίηση.</p>
        </Section>

        <Section num="6" title="Ασφάλεια δεδομένων">
            <p>Ο Εκτελών εφαρμόζει τα ακόλουθα μέτρα ασφαλείας:</p>
            <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <li>Κρυπτογράφηση δεδομένων σε ηρεμία (AES-256) και κατά τη μεταφορά (TLS 1.2+)</li>
                <li>Κρυπτογράφηση ευαίσθητων διαπιστευτηρίων (Vonage, Bland API keys)</li>
                <li>Έλεγχος πρόσβασης βάσει ρόλων (RBAC)</li>
                <li>Αυθεντικοποίηση δύο παραγόντων (MFA) για λογαριασμούς ιατρείων</li>
                <li>Τακτικά αντίγραφα ασφαλείας βάσης δεδομένων</li>
            </ul>
        </Section>

        <Section num="7" title="Δικαιώματα υποκειμένων">
            <p>Ο Εκτελών θα συνδράμει τον Υπεύθυνο στην ανταπόκριση σε αιτήματα άσκησης δικαιωμάτων (πρόσβαση, διόρθωση, διαγραφή, εναντίωση) εντός 5 εργάσιμων ημερών από τη λήψη σχετικού αιτήματος.</p>
        </Section>

        <Section num="8" title="Παραβιάσεις δεδομένων">
            <p>Σε περίπτωση παραβίασης δεδομένων, ο Εκτελών θα ενημερώσει τον Υπεύθυνο εντός <strong>72 ωρών</strong> από τη γνώση της παραβίασης, παρέχοντας: περιγραφή της παραβίασης, κατηγορίες και αριθμό επηρεαζόμενων υποκειμένων, πιθανές συνέπειες και μέτρα αντιμετώπισης.</p>
        </Section>

        <Section num="9" title="Διαγραφή δεδομένων">
            <p>Κατά τη λήξη ή καταγγελία της σύμβασης, ο Εκτελών θα διαγράψει όλα τα δεδομένα του Υπευθύνου εντός <strong>30 ημερών</strong>, εκτός εάν η νομοθεσία απαιτεί μεγαλύτερη διατήρηση. Ο Υπεύθυνος μπορεί να ζητήσει εξαγωγή δεδομένων πριν τη διαγραφή.</p>
        </Section>

        <Section num="10" title="Εφαρμοστέο δίκαιο">
            <p>Η παρούσα σύμβαση διέπεται από το δίκαιο της Ελληνικής Δημοκρατίας και τον ΓΚΠΔ (ΕΕ) 2016/679. Αρμόδια δικαστήρια: Δικαστήρια Αθηνών.</p>
        </Section>

        <div style={{ marginTop: '3rem', padding: '1.5rem', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#64748b' }}>
            <p><strong>Αποδοχή:</strong> Με την εγγραφή και χρήση της πλατφόρμας ClinicFlow, το ιατρείο αποδέχεται τους όρους της παρούσας Σύμβασης Επεξεργασίας Δεδομένων.</p>
            <p style={{ marginTop: '0.5rem' }}>Για ερωτήματα: <a href="mailto:mediablink8@gmail.com" style={{ color: '#6366f1' }}>mediablink8@gmail.com</a></p>
        </div>
    </div>
);

export default DataProcessingAgreement;
