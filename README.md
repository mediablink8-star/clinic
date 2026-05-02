# ClinicFlow

ClinicFlow is a clinic workflow automation system for appointment management, patient messaging, missed-call recovery, and AI-assisted triage.

## Features
- AI Triage for Greek dental symptoms.
- Automated Greek SMS/WhatsApp reminders.
- Staff dashboard for appointment management.
- Marketing and follow-up workflows.

## How to Run locally

### 1. Prerequisites
- Node.js 18+.
- PostgreSQL database.
- Redis instance for background jobs.
- Google Gemini API key.
- SMTP account for password reset email.

### 2. Setup
From the root directory:
```bash
npm run install-all
```

### 3. Environment Variables
Create a `.env` file in the `backend/` folder:
```env
PORT=4000
DATABASE_URL="postgresql://user:password@localhost:5432/clinic_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="generate_a_secure_random_string_here"
REFRESH_TOKEN_SECRET="generate_a_different_secure_random_string_here"
DB_ENCRYPTION_KEY="generate_a_secure_random_string_here"
GEMINI_API_KEY="your-gemini-api-key-here"
FRONTEND_URL="http://localhost:5173"
```

### 4. Database Initialization
Run migrations before starting the backend:
```bash
cd backend
npx prisma migrate deploy
```

### 5. Start the System
From the root directory:
```bash
npm run dev
```
- Backend (Gemini-powered): `http://localhost:4000`
- Frontend (Teal Dashboard): `http://localhost:5173`

## Production Checklist

- Set `NODE_ENV=production`, `FRONTEND_URL`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `DB_ENCRYPTION_KEY`, `SMTP_*`, and provider keys in the host environment.
- Set frontend `VITE_API_BASE_URL` to the deployed backend `/api` URL.
- Set n8n `BACKEND_API_URL` to the deployed backend `/api` URL and import the workflows in `backend/n8n`.
- Run `npm test` in `backend` and `npm run build` in `frontend` before deploying.

