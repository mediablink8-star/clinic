# ClinicFlow → n8n Integration Guide

This document describes how to set up the 6 n8n workflows that power ClinicFlow's
SMS automations. Each workflow is **shared across all clinics** — it receives
the `clinicId` in the payload and uses it to look up the right Twilio credentials.

---

## Architecture

```
┌──────────────┐       webhook POST       ┌─────────────────────┐
│  ClinicFlow  │ ────────────────────────▶ │  n8n (shared VPS)   │
│  (backend)   │  X-Webhook-Signature     │                     │
│              │  X-Webhook-Key           │  Workflow 1: ...    │
│              │  { event, data, clinic } │  Workflow 2: ...    │
└──────────────┘                          │  ...                │
                                          └──────────┬──────────┘
                                                     │ SMS API call
                                                     ▼
                                          ┌─────────────────────┐
                                          │  Twilio             │
                                          └──────────┬──────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  Patient phone      │
                                          └─────────────────────┘
```

**Key principle:** one n8n workflow per event type, shared across all clinics.
The workflow uses `data.clinicId` (or `clinic.id` in the payload) to look up the
right Twilio account SID/auth token from n8n's credential store, then sends the
SMS via the Twilio node.

---

## Webhook event format

Every webhook POST has this shape:

```json
{
  "event": "appointment.test",
  "timestamp": "2026-06-05T12:34:56.789Z",
  "data": {
    "appointmentId": "...",
    "patientPhone": "+306900000000",
    "patientName": "Γιώργος Παπαδόπουλος",
    "serviceName": "Καθαρισμός",
    "doctorName": "Dr. Smith",
    "date": "2026-06-15",
    "time": "10:00"
  },
  "clinic": {
    "id": "clinic_abc123",
    "name": "Οδοντιατρείο Σμυρνάκη",
    "phone": "+302101234567",
    "location": "Αθήνα",
    "workingHours": { ... },
    "services": [ ... ]
  },
  "backendUrl": "https://backend-l9el.onrender.com"
}
```

**Headers** (always present):
- `X-Webhook-Key: <clinic's webhookSecret>` — static per-clinic secret
- `X-Webhook-Signature: <hex(hmac_sha256(body, webhookSecret))>` — request signature

**Verify the signature in n8n** (Code node):
```js
const crypto = require('crypto');
const secret = $input.first().headers['x-webhook-key']; // or store per-clinic
const body = JSON.stringify($input.first().json);
const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
const received = $input.first().headers['x-webhook-signature'];
if (expected !== received) {
  throw new Error('Invalid signature');
}
return $input.all();
```

---

## The 5 required workflows (+ 1 optional)

For each workflow, set the **production path** in the n8n Webhook node to
`/webhook/<path>` below, then enable it. The user already configured
`N8N_WEBHOOK_URL=https://n8n-znz6.srv1664589.hstgr.cloud` in Render.

> **Why 5, not 6?** The original "Workflow 1 — Missed Call Recovery SMS" is
> now optional. Missed-call recovery SMSes are sent **directly** from the
> backend (via Twilio) — see [Zadarma→Vapi→Twilio flow](#zadarmavapitwilio-flow)
> below. The backend's `handleMissedCall` (called on Zadarma `NOTIFY_END`
> with `disposition != answered`) sends the initial recovery SMS via
> `twilioService.sendSmsWithTracking`. Vapi then takes over for the voice
> call. If you want a parallel log of missed calls in n8n (e.g. for a CRM or
> spreadsheet), build Workflow 1 anyway and fire it from a custom
> `missedCall.detected` event — but it's not on the default hot path.

### Workflow 1 (OPTIONAL) — Missed Call Recovery SMS log
- **n8n webhook path:** `/webhook/missed-call`
- **Event types:** `missed_call.*` (only if you add a custom event in `missedCallService.js`)
- **Trigger:** backend detects a missed call (custom event; default path doesn't fire this)
- **Action:** log to spreadsheet / CRM / Slack / etc. NOT for sending SMS.
- **Sample payload:** `{ caller: "+306900000001", callId: "...", timestamp: "..." }`
- **Status:** Optional. Skip if you don't need the log.

### Workflow 2 — Appointment Confirmation SMS
- **n8n webhook path:** `/webhook/appointment-confirmation`
- **Event types:** `appointment.*` (created, updated, cancelled)
- **Action:** send confirmation/reminder to patient
- **Sample payload:** `{ appointmentId, patientPhone, patientName, serviceName, doctorName, date, time }`
- **Suggested SMS body:**
  ```
  Αγαπητέ/ή {{$json.data.patientName}},
  το ραντεβού σας στο {{$json.clinic.name}} επιβεβαιώθηκε για {{$json.data.date}} {{$json.data.time}}.
  Υπηρεσία: {{$json.data.serviceName}} με {{$json.data.doctorName}}.
  Για αλλαγές καλέστε {{$json.clinic.phone}}.
  ```

### Workflow 3 — Appointment Reminder (24h before)
- **n8n webhook path:** `/webhook/appointment-reminder`
- **Event types:** `notification.*`
- **Action:** send 24h reminder
- **Sample payload:** `{ appointmentId, patientPhone, hoursUntil: 24 }`
- **Suggested SMS body:**
  ```
  Υπενθύμιση: αύριο {{$json.data.time}} έχετε ραντεβού στο {{$json.clinic.name}}.
  Αν χρειαστεί αλλαγή καλέστε {{$json.clinic.phone}}.
  ```

### Workflow 4 — Direct SMS (manual send from clinic UI)
- **n8n webhook path:** `/webhook/send-sms`
- **Event types:** `message.direct_send`
- **Action:** send arbitrary SMS typed by clinic owner
- **Sample payload:** `{ to: "+306900000000", body: "..." }`
- **Logic:** use the body's exact text, no template

### Workflow 5 — Inbound SMS Reply Handler
- **n8n webhook path:** `/webhook/inbound-sms`
- **Event types:** `message.inbound` (sent **from** n8n back to ClinicFlow)
- **Note:** this is the REVERSE direction. When Twilio receives an SMS reply,
  n8n forwards it to ClinicFlow via:
  ```
  POST https://backend-l9el.onrender.com/api/webhooks/inbound-sms
  Headers:
    x-clinicflow-secret: <clinic's webhookSecret>
    Content-Type: application/json
  Body:
  {
    "clinicId": "<from $json.clinic.id>",
    "from": "<patient phone>",
    "body": "<SMS text>",
    "provider": "sms"
  }
  ```
- **No SMS is sent** by this workflow. It only logs the inbound message.

### Workflow 6 — Review Request
- **n8n webhook path:** `/webhook/review-request`
- **Event types:** `review_request.*`
- **Trigger:** after a completed appointment (typically 1-2 hours after end)
- **Action:** send a Google review link
- **Sample payload:** `{ patientPhone, appointmentId, clinicName }`
- **Suggested SMS body:**
  ```
  Ευχαριστούμε που μας επισκεφτήκατε στο {{$json.data.clinicName}}!
  Αν είστε ευχαριστημένοι, αφήστε μας μια κριτική: https://g.page/r/...
  ```

---

## Per-clinic Twilio credentials

The user said "sms provider is twilio". For each clinic, store in n8n Credentials:
- **Twilio Account SID** (e.g. `ACxxxxx_clinic_A`)
- **Twilio Auth Token**
- **Twilio "From" phone number** (e.g. clinic's Greek number)

**One set per clinic.** The n8n workflow looks up the right credential set using
`$json.clinic.id` (or `$json.data.clinicId`) as the key.

**Concrete lookup pattern (Code node):**
```js
const clinicId = $json.clinic.id;
// In n8n, store credentials keyed by clinicId in a Set node or a static
// lookup table inside the workflow. E.g.:
const creds = {
  'clinic_abc': { accountSid: 'AC...', authToken: '...', from: '+30210...' },
  'clinic_xyz': { accountSid: 'AC...', authToken: '...', from: '+30210...' },
};
const c = creds[clinicId];
if (!c) throw new Error('No Twilio creds for clinic ' + clinicId);
return [{ json: { ...$json, _creds: c } }];
```

For a cleaner solution with many clinics, replace the hardcoded object with
a Postgres node or HTTP call to your own credential store.

---

## Testing each workflow

Once all 6 are set up:

1. In ClinicFlow, go to **Settings → Webhooks**
2. Paste the 6 URLs into the 6 fields (use the per-clinic override fields, not
   the Global URL — this lets you set different URLs per clinic if needed later)
3. Click **Test all 6** at the bottom of the section
4. Each workflow should respond 200 OK and you should see 6 green ✓

If any fail:
- **404 Not Found** → workflow not published in n8n
- **401/403** → n8n workflow has "Authentication" turned on; turn it OFF for the
  ClinicFlow webhooks (we use HMAC + static key in headers, not basic auth)
- **Timeout** → n8n VPS unreachable from your machine; check
  `https://n8n-znz6.srv1664589.hstgr.cloud` is up

---

## Production checklist before going live with a clinic

- [ ] All 6 workflows are published (toggle green in n8n)
- [ ] Each workflow's "Response Mode" is set to "On Received" (so ClinicFlow
      gets an immediate 200 ACK; long processing happens in the background)
- [ ] Twilio credentials are stored per-clinic in n8n
- [ ] "Test all 6" returns 6 green checks
- [ ] One real end-to-end test: book an appointment via `/book` page, confirm
      the patient receives the confirmation SMS within 30 seconds
