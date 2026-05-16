/**
 * Vapi Voice Service (integrates with Vonage for Greek numbers)
 */
const https = require('https');
const { decrypt } = require('./encryptionService');
const prisma = require('./prisma');
const { getAvailableSlots: _getSlots } = require('./slotUtils');

const VAPI_BASE = 'https://api.vapi.ai';

function vapiRequest(method, path, body, apiKey) {
    return new Promise((resolve, reject) => {
        const bodyStr = body ? JSON.stringify(body) : null;
        const parsed = new URL(VAPI_BASE + path);
        const req = https.request({
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
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
        req.setTimeout(20000, () => { req.destroy(); reject(new Error('Vapi request timeout')); });
        if (bodyStr) req.write(bodyStr);
        req.end();
    });
}

async function triggerOutboundCall({ clinic, phone, missedCallId, patientName }) {
    const apiKey = clinic.vapiApiKey ? decrypt(clinic.vapiApiKey) : process.env.VAPI_API_KEY;
    if (!apiKey) {
        console.warn('[Vapi] No API key configured for clinic', clinic.id);
        return { success: false, reason: 'no_api_key' };
    }

    const backendUrl = process.env.BACKEND_API_URL || '';
    if (!backendUrl) {
        console.warn('[Vapi] BACKEND_API_URL is not set — webhooks will fail.');
    }

    if (!clinic.vapiAssistantId && !process.env.VAPI_ASSISTANT_ID) {
        console.warn('[Vapi] No assistant ID configured');
        return { success: false, reason: 'no_assistant' };
    }

    if (!clinic.vapiPhoneNumberId && !process.env.VAPI_PHONE_NUMBER_ID) {
        console.warn('[Vapi] No phone number ID configured');
        return { success: false, reason: 'no_phone_number' };
    }

    let availableSlots = [];
    let doctorsInfo = '';
    try {
        const today = new Date();
        const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
        const todaySlots = await _getSlots(clinic.id, today, 'Europe/Athens', 60, null);
        const tomorrowSlots = await _getSlots(clinic.id, tomorrow, 'Europe/Athens', 60, null);
        if (todaySlots.length > 0) availableSlots.push({ day: 'σήμερα', slots: todaySlots.slice(0, 4) });
        if (tomorrowSlots.length > 0) availableSlots.push({ day: 'αύριο', slots: tomorrowSlots.slice(0, 4) });

        // Fetch doctors info for context
        const doctors = await prisma.doctor.findMany({ where: { clinicId: clinic.id, isActive: true } });
        if (doctors.length > 0) {
            doctorsInfo = doctors.map(d => `${d.name}${d.specialty ? ` (${d.specialty})` : ''}`).join(', ');
        }
    } catch (err) {
        console.warn('[Vapi] Data fetch failed:', err.message);
    }

    const systemPrompt = buildAgentPrompt(clinic, patientName, availableSlots, doctorsInfo);
    const assistantId = clinic.vapiAssistantId || process.env.VAPI_ASSISTANT_ID;
    const phoneNumberId = clinic.vapiPhoneNumberId || process.env.VAPI_PHONE_NUMBER_ID;

    const payload = {
        assistantId: assistantId,
        phoneNumberId: phoneNumberId,
        customer: {
            number: phone.startsWith('+') ? phone : `+${phone}`,
            name: patientName || undefined,
        },
        metadata: {
            missedCallId,
            clinicId: clinic.id,
            clinicName: clinic.name,
        },
        // Pass available slots and patient info as assistant overrides
        // so the assistant has context without replacing the full assistant config
        assistantOverrides: {
            variableValues: {
                clinicName: clinic.name || 'το ιατρείο',
                patientName: patientName || '',
                availableSlots: availableSlots.length > 0
                    ? availableSlots.map(d => `${d.day}: ${d.slots.join(', ')}`).join(' | ')
                    : 'Επικοινωνήστε μαζί μας για διαθεσιμότητα',
            }
        },
    };

    try {
        const result = await vapiRequest('POST', '/call', payload, apiKey);
        // Vapi returns 201 with status "queued" on success
        if ((result.status === 200 || result.status === 201) && result.data?.id) {
            console.info(`[Vapi] Outbound call triggered: ${result.data.id} → ***${phone.slice(-4)} (status: ${result.data.status})`);
            return { success: true, callId: result.data.id };
        }
        console.warn('[Vapi] Outbound call failed:', JSON.stringify(result.data));
        return { success: false, reason: result.data?.message || JSON.stringify(result.data) };
    } catch (err) {
        console.error('[Vapi] triggerOutboundCall error:', err.message);
        return { success: false, reason: err.message };
    }
}

function buildAgentPrompt(clinic, patientName, availableSlots = [], doctorsInfo = '') {
    let aiCfg = {};
    try { aiCfg = typeof clinic.aiConfig === 'string' ? JSON.parse(clinic.aiConfig) : (clinic.aiConfig || {}); } catch {}

    const clinicName = clinic.name || 'το ιατρείο';
    const services = aiCfg.services ? `Υπηρεσίες: ${aiCfg.services}` : '';
    const hours = aiCfg.workingHours ? `Ώρες λειτουργίας: ${JSON.stringify(aiCfg.workingHours)}` : '';
    const policies = aiCfg.policies ? `Πολιτικές: ${aiCfg.policies}` : '';
    const greeting = patientName ? `Γεια σας ${patientName}` : 'Γεια σας';

    const isKnownPatient = patientName && patientName !== '';
    const slotsText = availableSlots.length > 0
        ? availableSlots.map(d => `${d.day}: ${d.slots.join(', ')}`).join(' | ')
        : null;
    const nameInstruction = isKnownPatient
        ? `ΜΗΝ ρωτήσεις το όνομα — το ξέρεις ήδη: ${patientName}.`
        : `Ρώτα: "Πώς σας λένε;"`;
    
    const doctorsSection = doctorsInfo 
        ? `ΓΙΑΤΡΟΙ ΙΑΤΡΕΙΟΥ: ${doctorsInfo}. Αν ο ασθενής ρωτήσει, πες του ποιοι γιατροί είναι διαθέσιμοι.` 
        : '';

    return `Είσαι η Σοφία, η ζεστή και χαρούμενη βοηθός του ${clinicName}. Μιλάς Ελληνικά με ενθουσιασμό, ζεστασιά και φροντίδα — σαν να μιλάς σε έναν φίλο.

ΣΤΟΧΟΣ: Ο ασθενής έχασε μια κλήση από το ιατρείο. Κάνε τον να νιώσει ότι το ιατρείο νοιάζεται και βοήθησέ τον να κλείσει ραντεβού.

${services}
${hours}
${policies}
${doctorsSection}
${isKnownPatient ? `ΓΝΩΣΤΟΣ ΑΣΘΕΝΗΣ: ${patientName}` : ''}
${slotsText ? `ΔΙΑΘΕΣΙΜΕΣ ΩΡΕΣ: ${slotsText}` : ''}

ΟΔΗΓΙΕΣ:
1. Ξεκίνα: "${greeting}! Εδώ η Σοφία από το ${clinicName}! 😊 Είδαμε ότι μας καλέσατε νωρίτερα και θέλαμε να επικοινωνήσουμε μαζί σας! Πώς μπορώ να σας βοηθήσω;"
2. ${nameInstruction}
3. ${slotsText ? `Πες διαθέσιμες ώρες: ${slotsText}` : 'Ρώτα ποια μέρα και ώρα βολεύει;'}
4. Αν θέλει ραντεβού, στείλε το request με τα στοιχεία στο server.
5. Αν ο ασθενής θέλει συγκεκριμένο γιατρό, σημείωσέ το αν μπορείς ή πες του ότι θα το δούμε στην επιβεβαίωση.
6. Μίλα με ζεστασιά. Πες "Τέλεια!", "Υπέροχα!", "Χαρά μου!".
7. Αν κλείσει ραντεβού: "Τέλεια! Ανυπομονούμε να σας δούμε! 😊"

Σημαντικό: Πρέπει να στείλεις το request στο server για να καταχωρηθεί το ραντεβού.`;
}

async function importVonageNumber({ clinic, vonageNumber, credentialId }) {
    const apiKey = clinic.vapiApiKey ? decrypt(clinic.vapiApiKey) : process.env.VAPI_API_KEY;
    if (!apiKey) {
        return { success: false, reason: 'no_api_key' };
    }

    const payload = {
        provider: 'vonage',
        number: vonageNumber,
        credentialId: credentialId,
        name: `Vonage ${vonageNumber}`,
    };

    try {
        const result = await vapiRequest('POST', '/phone-number', payload, apiKey);
        if (result.status === 200 && result.data?.id) {
            console.info(`[Vapi] Imported Vonage number: ${vonageNumber}`);
            return { success: true, phoneNumberId: result.data.id };
        }
        return { success: false, reason: JSON.stringify(result.data) };
    } catch (err) {
        return { success: false, reason: err.message };
    }
}

async function getCallDetails(callId) {
    const apiKey = process.env.VAPI_API_KEY;
    try {
        const result = await vapiRequest('GET', `/call/${callId}`, null, apiKey);
        return result.data;
    } catch (err) {
        console.error('[Vapi] getCallDetails error:', err.message);
        return null;
    }
}

module.exports = { triggerOutboundCall, buildAgentPrompt, importVonageNumber, getCallDetails };