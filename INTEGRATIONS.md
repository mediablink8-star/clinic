# 🔌 External Integrations Guide (Make.com & n8n)

Connect your ClinicFlow SaaS backend to **Google Calendar** and **SMS Services** using your preferred automation platform.

## 1. Setup
Set the `N8N_WEBHOOK_URL` in your `.env` file to point to your automation platform's webhook URL.
*(Note: Start with `http://localhost:5678/...` for n8n local, or `https://hook.make.com/...` for Make).*

## 2. Events Payload
The backend sends this JSON for every event:

```json
{
  "event": "appointment.created", // or "notification.send"
  "data": { ... }
}
```

---

## 🟣 Option A: Make.com (formerly Integromat)

Since n8n files do not work in Make, I have created a **Make-compatible Blueprint** for you.

### 1. Import Blueprint
1.  Create a new Scenario in Make.
2.  Click the **More** (three dots) icon at the bottom → **Import Blueprint**.
3.  Select the file: `backend/make_blueprint.json`.
4.  You will see: **Webhook -> Router**.

### 2. Add Modules Manually
*Note: We add these manually to ensure you get the latest version for your account.*

**Branch 1: Calendar**
1.  Click the top path of the Router.
2.  Search **Google Calendar** → **Create an Event**.
3.  Connect your account.
4.  Map the fields:
    *   **Calendar ID**: Primary
    *   **Event Name**: `{{1.body.data.patientName}}`
    *   **Start Date**: `{{1.body.data.date}}T{{1.body.data.time}}:00`

**Branch 2: SMS**
1.  Click the bottom path of the Router.
2.  Search **Twilio** → **Create a Message**.
3.  Connect your account (SID/Token).
4.  Map the fields:
    *   **To**: `{{1.body.data.clinicPhone}}`
    *   **Body**: `{{1.body.data.message}}`

### 3. Update Backend
Paste the Webhook address into your `backend/.env` file:
```bash
N8N_WEBHOOK_URL=https://hook.make.com/your-unique-id
```

---

## 🟠 Option B: n8n (Self-Hosted)

### 1. Import Workflow
1.  Open n8n.
2.  **Workflow** → **Import from File**.
3.  Select `backend/n8n_workflow.json`.

### 2. Start Tunnel
```bash
npx n8n start --tunnel
```

### 3. Update Backend
Copy the test URL from the Webhook node into your `.env`.
