/**
 * Bland AI Voice Service
 */
const https = require('https');
const { decrypt } = require('./encryptionService');
const prisma = require('./prisma');
const { getAvailableSlots } = require('./appointmentService');

const BLAND_BASE = 'https://api.bland.ai/v1';

function blandRequest(method, path, body, apiKey) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const parsed = new URL(BLAND_BASE + path);
        const req = https.request({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                'authorization': apiKey,
                'Content-Type': 'application/json',
                ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
            },
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, data }); }
            });
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(); reject(new Error('Bland AI request timeout')); });
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function triggerOutboundCall({ clinic, phone, missedCallId, patientName }) {
    const apiKey = clinic.blandApiKey ? decrypt(clinic.blandApiKey) : process.env.BLAND_API_KEY;
    if (!apiKey) {
        console.warn('[Bland] No API key configured for clinic', clinic.id);
        return { success: false, reason: 'no_api_key' };
    }

    const backendUrl = process.env.BACKEND_API_URL || '';
    if (!backendUrl) {
        console.warn('[Bland] BACKEND_API_URL is not set — tool callbacks and webhooks will fail. Set BACKEND_API_URL in your environment.');
    }
    // Fetch available slots for today and tomorrow
    let availableSlots = [];
    try {
        const today = new Date();
        const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
        const todaySlots = await getAvailableSlots(clinic.id, today);
        const tomorrowSlots = await getAvailableSlots(clinic.id, tomorrow);
        if (todaySlots.length > 0) availableSlots.push({ day: 'σήμερα', slots: todaySlots.slice(0, 4) });
        if (tomorrowSlots.length > 0) availableSlots.push({ day: 'αύριο', slots: tomorrowSlots.slice(0, 4) });
    } catch (err) {
        console.warn('[Bland] Slot fetch failed:', err.message);
    }

    const prompt = buildAgentPrompt(clinic, patientName, availableSlots);
    const phoneNumberId = clinic.blandPhoneNumberId || process.env.BLAND_PHONE_NUMBER_ID;

    const payload = {
        phone_number: phone,
        ...(phoneNumberId && { from: phoneNumberId }),
        task: prompt,
        voice: clinic.blandVoiceId || process.env.BLAND_VOICE_ID || 'maya',
        language: 'el',
        max_duration: 5,
        answered_by_enabled: true,
        wait_for_greeting: true,
        record: false,
        metadata: {
            missedCallId,
            clinicId: clinic.id,
            clinicName: clinic.name,
        },
        webhook: `${backendUrl}/bland/webhook`,
        // Bland tools require a url field pointing to our webhook
        tools: [
            {
                name: 'book_appointment',
                description: 'Call this when the patient confirms they want to book an appointment and provides their name, preferred day and time.',
                url: `${backendUrl}/bland/tool`,
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
                url: `${backendUrl}/bland/tool`,
                method: 'POST',
                input_schema: { type: 'object', properties: {} },
            },
        ],
    };

    try {
        const result = await blandRequest('POST', '/calls', payload, apiKey);
        if (result.status === 200 && result.data?.call_id) {
            console.log(`[Bland] Outbound call triggered: ${result.data.call_id} → ${phone}`);
            return { success: true, callId: result.data.call_id };
        }
        console.warn('[Bland] Outbound call failed:', JSON.stringify(result.data));
        return { success: false, reason: result.data?.message || JSON.stringify(result.data) };
    } catch (err) {
        console.error('[Bland] triggerOutboundCall error:', err.message);
        return { success: false, reason: err.message };
    }
}

function buildAgentPrompt(clinic, patientName, availableSlots = []) {
    let aiCfg = {};
    try { aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {}); } catch {}

    const clinicName = clinic.name || 'το ιατρείο';
    const services = aiCfg.services ? `\nΥπηρεσίες: ${aiCfg.services}` : '';
    const hours = aiCfg.workingHours ? `\nΏρες λειτουργίας: ${JSON.stringify(aiCfg.workingHours)}` : '';
    const policies = aiCfg.policies ? `\nΠολιτικές: ${aiCfg.policies}` : '';
    const greeting = patientName ? `Γεια σας ${patientName}` : 'Γεια σας';

    const isKnownPatient = patientName && patientName !== '';
    const slotsText = availableSlots.length > 0
        ? availableSlots.map(d => `${d.day}: ${d.slots.join(', ')}`).join(' | ')
        : null;
    const nameInstruction = isKnownPatient
        ? `   - ΜΗΝ ρωτήσεις το όνομα — το ξέρεις ήδη: ${patientName}. Χρησιμοποίησε αυτό το όνομα στο tool.`
        : `   - Ρώτα: "Πώς σας λένε;"`;

    return `Είσαι η Σοφία, η ζεστή και χαρούμενη βοηθός του ${clinicName}. Μιλάς Ελληνικά με ενθουσιασμό, ζεστασιά και φροντίδα — σαν να μιλάς σε έναν φίλο. Χρησιμοποιείς θετικές εκφράσεις, γελάς εύκολα και κάνεις τον ασθενή να νιώθει ευπρόσδεκτος.

ΣΤΟΧΟΣ: Ο ασθενής έχασε μια κλήση από το ιατρείο. Κάνε τον να νιώσει ότι το ιατρείο νοιάζεται και βοήθησέ τον να κλείσει ραντεβού.

ΠΛΗΡΟΦΟΡΙΕΣ ΙΑΤΡΕΙΟΥ:${services}${hours}${policies}
${isKnownPatient ? `ΓΝΩΣΤΟΣ ΑΣΘΕΝΗΣ: ${patientName} — ΜΗΝ ρωτήσεις το όνομα ξανά.` : ''}
${slotsText ? `ΔΙΑΘΕΣΙΜΕΣ ΩΡΕΣ: ${slotsText}` : ''}

ΟΔΗΓΙΕΣ - ΑΚΟΛΟΥΘΑ ΑΥΣΤΗΡΑ:
1. Ξεκίνα με ενθουσιασμό: "${greeting}! Εδώ η Σοφία από το ${clinicName}! 😊 Είδαμε ότι μας καλέσατε νωρίτερα και θέλαμε οπωσδήποτε να επικοινωνήσουμε μαζί σας! Πώς μπορώ να σας βοηθήσω σήμερα;"
2. Αν θέλει ραντεβού:
${nameInstruction}
   - ${slotsText ? `Πες: "Έχω διαθέσιμες ώρες ${slotsText}. Ποια σας βολεύει;"` : 'Ρώτα: "Ποια μέρα και ώρα σας βολεύει;"'}
   - ΑΜΕΣΩΣ μετά κάλεσε το tool book_appointment με patient_name="${isKnownPatient ? patientName : '[όνομα που έδωσε]'}", preferred_day, preferred_time
   - ΜΗΝ πεις "κλείστηκε" χωρίς να καλέσεις πρώτα το tool
3. Αν έχει ερώτηση: απάντησε βάσει των πληροφοριών του ιατρείου. Μετά ρώτα αν θέλει ραντεβού.
4. Αν θέλει επανάκληση: κάλεσε το tool request_callback.
5. Μίλα με ζεστασιά και ενθουσιασμό. Χρησιμοποίησε εκφράσεις όπως "Τέλεια!", "Υπέροχα!", "Χαρά μου!", "Εξαιρετικά!". Κάνε τον ασθενή να νιώθει ότι η κλήση του είναι σημαντική.
6. Αν ο ασθενής κλείσει ραντεβού, πες κάτι σαν "Τέλεια! Ανυπομονούμε να σας δούμε! Να έχετε μια υπέροχη μέρα! 😊"

ΚΡΙΣΙΜΟ: Το tool book_appointment ΠΡΕΠΕΙ να κληθεί για να καταχωρηθεί το ραντεβού στο σύστημα.`;
}

async function getCallDetails(callId, apiKey) {
    try {
        const result = await blandRequest('GET', `/calls/${callId}`, null, apiKey);
        return result.data;
    } catch (err) {
        console.error('[Bland] getCallDetails error:', err.message);
        return null;
    }
}

module.exports = { triggerOutboundCall, buildAgentPrompt, getCallDetails };
