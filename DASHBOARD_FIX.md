# Dashboard 500 Error - Diagnosis and Fix

## Problem
The dashboard shows a 500 error with the message:
```
Σφάλμα Συστήματος
Παρουσιάστηκε ένα μη αναμενόμενο σφάλμα στο σύστημα.
Minified React error #310
```

## Root Cause
React error #310 means "Element type is invalid" - this typically happens when:
1. A component import fails at runtime
2. The backend API is not running, causing React Query hooks to fail
3. Missing environment variables

## What Was Fixed

### 1. Removed Unused Import
- Removed unused `StatCard` import from `Dashboard.jsx`

### 2. Created Missing Environment Files

#### Frontend `.env` file created:
```env
VITE_API_BASE_URL=http://localhost:4000/api
VITE_GOOGLE_CLIENT_ID=
VITE_SENTRY_DSN=
```

#### Backend `.env` file created:
```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:5173
DATABASE_URL="postgresql://mbas_user:mbas_password@localhost:5432/mbas_database?schema=public"
REDIS_URL="redis://localhost:6379"
DISABLE_REDIS=true
JWT_SECRET="local-dev-jwt-secret-not-for-production-change-this-in-production"
DB_ENCRYPTION_KEY="local-dev-encryption-key-32-bytes-change-in-production!!"
# ... (other variables with empty values for optional features)
```

### 3. Added Error Handling to Dashboard
Added safety checks in the Dashboard component to handle missing props gracefully.

## How to Start the Application

### Step 1: Start the Database and Redis
```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Redis on port 6379

### Step 2: Run Database Migrations
```bash
cd backend
npm run prisma:migrate
```

### Step 3: Start the Backend
```bash
cd backend
npm run dev
```

This starts:
- API server on port 4000
- Background worker for processing jobs

### Step 4: Start the Frontend
```bash
cd frontend
npm run dev
```

This starts the Vite dev server on port 5173.

### Step 5: Access the Application
Open your browser and navigate to:
```
http://localhost:5173
```

## Verification Steps

1. **Check Docker containers are running:**
   ```bash
   docker ps
   ```
   You should see `mbas-postgres` and `mbas-redis` containers running.

2. **Check backend is running:**
   ```bash
   curl http://localhost:4000/api/health
   ```
   Should return a health check response.

3. **Check frontend is accessible:**
   Open `http://localhost:5173` in your browser.

## Common Issues

### Issue: "Cannot connect to database"
**Solution:** Make sure Docker containers are running:
```bash
docker-compose up -d
```

### Issue: "Port 5432 already in use"
**Solution:** Either stop the existing PostgreSQL service or change the port in `docker-compose.yml` and update `DATABASE_URL` in `backend/.env`.

### Issue: "Prisma Client not generated"
**Solution:** Run:
```bash
cd backend
npx prisma generate
```

### Issue: Frontend still shows 500 error
**Solution:** 
1. Check browser console for detailed error messages
2. Ensure backend is running and accessible
3. Clear browser cache and reload
4. Check that `VITE_API_BASE_URL` in `frontend/.env` matches your backend URL

## Production Deployment Notes

Before deploying to production:

1. **Change all secrets:**
   - Generate new `JWT_SECRET` (64+ random characters)
   - Generate new `DB_ENCRYPTION_KEY` (32+ random characters)
   - Generate new `WEBHOOK_SECRET`

2. **Set up proper database:**
   - Use a managed PostgreSQL service (Supabase, Neon, Railway, etc.)
   - Update `DATABASE_URL` with production credentials

3. **Configure Redis:**
   - Use a managed Redis service (Upstash, Redis Cloud, etc.)
   - Set `DISABLE_REDIS=false`
   - Update `REDIS_URL`

4. **Set up email:**
   - Configure SMTP settings for password reset emails
   - Use a service like Resend, SendGrid, or Mailgun

5. **Configure integrations:**
   - Add `GEMINI_API_KEY` for AI features
   - Add Vonage credentials for SMS
   - Add Vapi credentials for voice calls (optional)

6. **Update CORS:**
   - Set `FRONTEND_URL` to your production frontend URL

## Next Steps

1. Create a clinic account by registering at `/register`
2. Complete the onboarding wizard
3. Configure clinic settings (working hours, services, etc.)
4. Add patients
5. Test the appointment booking flow
6. Test the missed call recovery system

## Support

If you continue to experience issues:
1. Check the browser console for detailed error messages
2. Check backend logs for API errors
3. Verify all environment variables are set correctly
4. Ensure all services (database, Redis, backend, frontend) are running
