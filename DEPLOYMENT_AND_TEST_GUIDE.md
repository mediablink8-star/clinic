# Deployment & Testing Guide

## PHASE 1 — Deploy the App (30 minutes)

### 1.1 Backend on Railway

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select your repo, set root directory to `backend`
3. Add these environment variables:

```
NODE_ENV=production
DATABASE_URL=<your Supabase connection string>
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
DB_ENCRYPTION_KEY=<generate same way>
REFRESH_TOKEN_SECRET=<generate same way>
AUTOMATION_API_KEY=<generate same way>
WEBHOOK_SECRET=<generate same way>
FRONTEND_URL=https://your-app.vercel.app
BACKEND_API_URL=https://your-backend.railway.app/api
DISABLE_REDIS=false
```

4. Railway will auto-detect `package.json` and run `npm start`
5. Note your Railway URL: `https://your-backend.railway.app`

### 1.2 Redis on Upstash

1. Go to https://upstash.com → Create Database → Redis
2. Choose region closest to your Railway region
3. Copy the `REDIS_URL` (starts with `rediss://`)
4. Add to Railway env vars: `REDIS_URL=rediss://...`

### 1.3 Frontend on Vercel

1. Go to https://vercel.com → New Project → Import from GitHub
2. Set root directory to `frontend`
3. Add environment variables:
```
VITE_API_BASE_URL=https://your-backend.railway.app/api
```
4. Deploy. Note your Vercel URL.
5. Go back to Railway and update `FRONTEND_URL` to your Vercel URL.

### 1.4 Run Database Migration

In Railway terminal or locally with production DATABASE_URL:
```bash
cd backend
npx prisma migrate deploy
```

### 1.5 Verify Deployment

Open `https://your-backend.railway.app/api/health`

Expected response:
```json
{ "status": "ok", "db": "ok", "redis": "ok" }
```

If redis shows "disabled" → check REDIS_URL and DISABLE_REDIS=false

---

## PHASE 2 — Basic App Test (15 minutes)

### 2.1 Register a Clinic
- Go to your Vercel URL
- Click "Δημιουργία Λογαριασμού"
- Fill in clinic name, email, phone, password
- ✅ Should land on dashboard

### 2.2 Create a Patient
- Go to Ασθενείς → Νέος Ασθενής
- Name: Δοκιμαστικός Ασθενής
- Phone: your own mobile number
- ✅ Patient appears in list

### 2.3 Create an Appointment
- Click "Νέο Ραντεβού"
- Select the test patient
- Pick a date 2+ days from now, any time
- ✅ Appointment appears in calendar and appointments tab
- ✅ Toast shows "Το ραντεβού καταχωρήθηκε επιτυχώς!"

### 2.4 Verify Reminder Was Scheduled
In Supabase → Table Editor → Notification table
- Should see 1 row with type=REMINDER, status=SCHEDULED
- scheduledFor should be 24h before the appointment
- ✅ Reminder is queued

### 2.5 Test Public Booking
- Go to Settings → copy the booking link
- Open in incognito/different browser
- Fill in name, phone, pick a date and time
- ✅ Booking confirmation shown
- ✅ Appointment appears in dashboard

---

## PHASE 3 — SMS Setup (45 minutes)

### 3.1 Create Vonage Account
1. Go to https://vonage.com → Sign up
2. Get a Greek virtual number (+30...)
3. Note your API Key and API Secret from dashboard

### 3.2 Configure Vonage in ClinicFlow
- Settings → Webhooks → Vonage section
- Enter API Key and API Secret
- Vonage From Name: your clinic name or number
- Save

### 3.3 Set Up n8n

**Option A: n8n Cloud (easier)**
1. Go to https://n8n.io → Start free trial
2. Note your n8n URL: `https://your-instance.app.n8n.cloud`

**Option B: Self-host on Railway (cheaper)**
1. New Railway service → Docker image: `n8nio/n8n`
2. Add env var: `N8N_BASIC_AUTH_ACTIVE=true`, `N8N_BASIC_AUTH_USER=admin`, `N8N_BASIC_AUTH_PASSWORD=yourpassword`

### 3.4 Import n8n Workflows
1. In n8n → Import from file
2. Import all 6 files from `backend/n8n/` folder in order:
   - workflow_0_global_error_handler.json
   - workflow_1_appointment_confirmation.json
   - workflow_2_direct_sms.json
   - workflow_3_missed_call_recovery.json
   - workflow_4_scheduled_sms_processor.json
   - workflow_5_inbound_sms_reply.json
3. Activate all workflows

### 3.5 Set n8n Environment Variables
In n8n → Settings → Variables, add:
```
BACKEND_API_URL = https://your-backend.railway.app/api
AUTOMATION_API_KEY = <same value as in Railway>
VONAGE_API_KEY = <your Vonage key>
VONAGE_API_SECRET = <your Vonage secret>
VONAGE_FROM_NUMBER = <your Greek number>
```

### 3.6 Configure Webhooks in ClinicFlow
- Settings → Webhooks
- Missed Call Webhook: `https://your-n8n.app.n8n.cloud/webhook/missed-call`
- Direct SMS Webhook: `https://your-n8n.app.n8n.cloud/webhook/direct-sms`
- Reminders Webhook: `https://your-n8n.app.n8n.cloud/webhook/send-notification`
- Save

### 3.7 Add n8n URL to Railway
```
N8N_WEBHOOK_URL=https://your-n8n.app.n8n.cloud/webhook
```

---

## PHASE 4 — Test SMS Recovery (20 minutes)

### 4.1 Test Direct SMS
- Dashboard → Quick Actions → SMS
- Select test patient
- Send "Δοκιμαστικό μήνυμα"
- ✅ SMS arrives on your phone within 30 seconds

### 4.2 Test Missed Call Recovery
- Dashboard → Quick Actions → "Δοκιμή Ρύθμισης"
- Enter your mobile number
- Click "Εκτέλεση Δοκιμής"
- ✅ SMS arrives: "Γεια 👋 χάσαμε την κλήση σας..."
- ✅ Recovery Feed shows new entry
- ✅ MissedCall appears in Supabase with status=RECOVERING

### 4.3 Test the Booking Link
- Click the link in the SMS you received
- Book an appointment
- ✅ Appointment created in dashboard
- ✅ MissedCall status changes to RECOVERED
- ✅ Revenue shows in dashboard

### 4.4 Test Real Missed Call (final test)
- Set up call forwarding on clinic phone to Vonage number
- Call the clinic from a different phone, don't answer
- ✅ SMS arrives within 60 seconds
- ✅ Recovery case appears in dashboard

---

## PHASE 5 — Email Setup (10 minutes)

### 5.1 Create Resend Account
1. Go to https://resend.com → Sign up (free)
2. Add your domain or use their sandbox
3. Get API key

### 5.2 Add to Railway
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<your Resend API key>
SMTP_FROM=ClinicFlow <no-reply@yourdomain.com>
```

### 5.3 Test Password Reset
- Log out
- Click "Ξεχάσατε τον κωδικό;"
- Enter your email
- ✅ Email arrives with reset link

---

## PHASE 6 — Voice AI Setup (optional, 60 minutes)

### 6.1 Create Vapi Account
1. Go to https://vapi.ai → Sign up
2. Create an Assistant with the Greek prompt from `backend/services/vapiService.js`
3. Note the Assistant ID

### 6.2 Import Vonage Number to Vapi
1. In Vapi → Phone Numbers → Import
2. Select Vonage, enter your credentials
3. Note the Phone Number ID

### 6.3 Configure in ClinicFlow
- Settings → Voice AI
- Enter Vapi API Key, Assistant ID, Phone Number ID
- Enable Voice AI toggle
- Save

### 6.4 Test Voice Call
- Dashboard → Quick Actions → "Δοκιμή Ρύθμισης"
- Enter your mobile number
- ✅ Your phone rings
- ✅ Sophia AI greets you in Greek
- ✅ If you say "θέλω ραντεβού" → she books it

---

## Checklist Summary

- [ ] Backend deployed on Railway
- [ ] Redis connected (Upstash)
- [ ] Frontend deployed on Vercel
- [ ] Database migrated
- [ ] /api/health returns ok
- [ ] Can register and login
- [ ] Can create patient and appointment
- [ ] Reminder notification scheduled in DB
- [ ] Vonage account created
- [ ] n8n workflows imported and active
- [ ] Webhooks configured in ClinicFlow
- [ ] Direct SMS test passes
- [ ] Missed call test passes
- [ ] Booking link recovery works
- [ ] Revenue tracked correctly
- [ ] Email (password reset) works
- [ ] Real missed call test passes
- [ ] [ OPTIONAL ] Voice AI configured and tested
