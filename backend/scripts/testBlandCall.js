const https = require('https');

const prompt = `Είσαι η Σοφία, η ζεστή και χαρούμενη βοηθός του ιατρείου. Μιλάς Ελληνικά με ενθουσιασμό, ζεστασιά και φροντίδα — σαν να μιλάς σε έναν φίλο.

ΣΤΟΧΟΣ: Ο ασθενής έχασε μια κλήση από το ιατρείο. Κάνε τον να νιώσει ότι το ιατρείο νοιάζεται και βοήθησέ τον να κλείσει ραντεβού.

ΟΔΗΓΙΕΣ:
1. Ξεκίνα: "Γεια σας! Εδώ η Σοφία από το ιατρείο! Είδαμε ότι μας καλέσατε νωρίτερα και θέλαμε οπωσδήποτε να επικοινωνήσουμε μαζί σας! Πώς μπορώ να σας βοηθήσω σήμερα;"
2. Αν θέλει ραντεβού:
   - Ρώτα: "Πώς σας λένε;"
   - Ρώτα: "Ποια μέρα και ώρα σας βολεύει;"
   - Κάλεσε το tool book_appointment με τα στοιχεία.
3. Μίλα με ζεστασιά. Χρησιμοποίησε "Τέλεια!", "Υπέροχα!", "Χαρά μου!".
4. Αν κλείσει ραντεβού: "Τέλεια! Ανυπομονούμε να σας δούμε! Να έχετε μια υπέροχη μέρα!"

ΚΡΙΣΙΜΟ: Το tool book_appointment ΠΡΕΠΕΙ να κληθεί για να καταχωρηθεί το ραντεβού.`;

const payload = JSON.stringify({
    phone_number: '+306996068659',
    task: prompt,
    voice: 'maya',
    language: 'el',
    max_duration: 5,
    answered_by_enabled: true,
    wait_for_greeting: true,
    record: false,
    webhook: 'https://backend-l9el.onrender.com/api/bland/webhook',
    tools: [
        {
            name: 'book_appointment',
            description: 'Call this when the patient confirms they want to book an appointment and provides their name, preferred day and time.',
            url: 'https://backend-l9el.onrender.com/api/bland/tool',
            method: 'POST',
            input_schema: {
                type: 'object',
                properties: {
                    patient_name: { type: 'string', description: 'Full name of the patient' },
                    preferred_day: { type: 'string', description: 'Preferred day' },
                    preferred_time: { type: 'string', description: 'Preferred time' },
                },
                required: ['patient_name', 'preferred_day', 'preferred_time'],
            },
        },
        {
            name: 'request_callback',
            description: 'Call this when the patient asks to be called back by a human.',
            url: 'https://backend-l9el.onrender.com/api/bland/tool',
            method: 'POST',
            input_schema: { type: 'object', properties: {} },
        }
    ]
});

const req = https.request({
    hostname: 'api.bland.ai',
    path: '/v1/calls',
    method: 'POST',
    headers: {
        'authorization': 'org_66f31e6882102ee805edf160811f118dc658608210a689b176cb496d73072a402c55841089863fbb334669',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, '\nResponse:', data));
});
req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
