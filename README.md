# Greek Clinic Automation System

This is a fully working workflow automation system for a dental clinic in Greece.

## Features
- AI Triage for Greek dental symptoms.
- Automated Greek SMS/WhatsApp reminders.
- Staff dashboard for appointment management.
- Marketing and follow-up workflows.

## How to Run locally

### 1. Prerequisites
- Node.js installed.
- Google Gemini API Key.
- (Optional) SQLite is used by default for easy local testing.

### 2. Setup
From the root directory (`clinic-automation/`):
```bash
npm run install-all
```

### 3. Environment Variables
Create a `.env` file in the `backend/` folder:
```env
DATABASE_URL="file:./dev.db"
PORT=4000
GEMINI_API_KEY="your-gemini-api-key-here"
```

### 4. Database Initialization
I have already initialized the database for you using `npx prisma db push`. 
If you make schema changes, run:
```bash
npx prisma db push
```

### 5. Start the System
From the root directory:
```bash
npm run dev
```
- Backend (Gemini-powered): `http://localhost:4000`
- Frontend (Teal Dashboard): `http://localhost:5173`

