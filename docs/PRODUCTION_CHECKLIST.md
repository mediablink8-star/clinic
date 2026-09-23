# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
- [ ] Confirm production secrets are set in the hosting provider, not committed to Git.
- [ ] Confirm `NODE_ENV=production`.
- [ ] Confirm `VAPI_WEBHOOK_SECRET` is set (production rejects Vapi webhooks without it).
- [ ] Confirm `ZADARMA_WEBHOOK_SECRET` is set.
- [ ] Confirm `SENTRY_BACKEND_DSN` is configured and receiving a test event.
- [ ] Confirm `DATABASE_URL` points only to the production database.
- [ ] Confirm `REDIS_URL` points only to the production Redis instance.
- [ ] Confirm outbound SMS/voice credentials belong to the intended production accounts.
- [ ] Confirm `FRONTEND_URL` is the exact production origin.

### 1a. Emergency controls
- [ ] Clinic `isActive` is the master clinic workflow kill switch.
- [ ] `voiceEnabled=false` is the per-clinic voice AI kill switch.
- [ ] Keep provider credentials revocable so outbound voice/SMS can be disabled immediately if needed.
- [ ] `DATABASE_URL` - PostgreSQL connection string (Supabase/Neon/Render)
- [ ] `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- [ ] `DB_ENCRYPTION_KEY` - Generate same as JWT_SECRET
- [ ] `FRONTEND_URL` - Your deployed frontend URL (for CORS)
- [ ] `NODE_ENV=production`
- [ ] `REDIS_URL` - Upstash Redis or similar (required for background jobs)
- [ ] `DISABLE_REDIS=false` - Enable Redis in production
- [ ] `WEBHOOK_SECRET` - Generate same as JWT_SECRET
- [ ] `GEMINI_API_KEY` - Google AI API key for Sophia assistant
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email provider
- [ ] `N8N_WEBHOOK_URL` - n8n instance for SMS workflows
- [ ] `VAPI_API_KEY` - Voice AI (optional)
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_ALPHA_SENDER_ID` - SMS provider (Twilio)
- [ ] `ZADARMA_API_KEY`, `ZADARMA_API_SECRET` - VoIP provider (Zadarma for Vapi phone numbers)
- [ ] `SENTRY_BACKEND_DSN` - Error tracking (optional)

### 2. Database Setup
- [ ] Run `npx prisma migrate deploy` against production.
- [ ] Confirm the latest migrations are applied, including Google OAuth state, calendar sync status, and Vapi call ID.
- [ ] Verify automated database backups are enabled at the hosting/database provider.
- [ ] Perform and document a restore test before importing real patient data.
- [ ] Never seed demo data into the production database.
```bash
# Run migrations
cd backend
npx prisma migrate deploy

# Optional: Seed demo data (only for testing)
# npx prisma db seed
```

### 3. Build Frontend ✅
```bash
cd frontend
npm install
npm run build
# Deploy dist/ folder to Vercel/Netlify/Cloudflare Pages
```

### 4. Backend Deployment ✅
```bash
cd backend
npm install
# Deploy to Render/Railway/Fly.io
# Ensure worker process is enabled (DISABLE_WORKER=false)
```

## Security Checklist

### Authentication & Authorization ✅
- [x] JWT tokens with secure secrets
- [x] Password hashing with bcrypt
- [x] Role-based access control (OWNER, ADMIN, RECEPTIONIST, ASSISTANT)
- [x] MFA support with TOTP
- [x] Account lockout after failed attempts
- [x] Secure password reset flow

### API Security ✅
- [x] Rate limiting on all endpoints
- [x] CORS configured for production domain only
- [x] Helmet.js security headers
- [x] HMAC webhook signature verification
- [x] Input validation with Joi schemas
- [x] SQL injection prevention (Prisma ORM)
- [x] XSS prevention (React escaping)

### Data Protection
- [ ] Review data-controller/data-processor roles and the Article 28 DPA with appropriate legal/privacy counsel.
- [ ] Inventory subprocessors and any third-country transfers.
- [ ] Define retention/deletion procedures.
- [ ] Confirm patient-data access and deletion workflows.
- [ ] Document technical and organizational security measures.
- [ ] Do not market ClinicFlow as “fully GDPR compliant” until the legal/compliance review supports that statement.

### Data Protection (implemented controls)
- [x] Sensitive data encrypted at rest (DB_ENCRYPTION_KEY)
- [x] HTTPS enforced in production
- [x] Audit logging for all critical actions
- [ ] GDPR compliance/legal review completed
- [x] Phone number normalization and validation

## Feature Verification

### Core Features ✅
- [x] Patient management (CRUD)
- [x] Appointment booking (dashboard, public, voice, SMS)
- [x] Double-booking prevention with row-level locking
- [x] Calendar view with appointment sync
- [x] Recovery tracking and analytics
- [x] SMS reminders and follow-ups
- [x] Voice AI integration (Vapi)
- [x] Inbound SMS handling
- [x] AI assistant (Sophia) with Gemini

### Background Workers ✅
- [x] Worker runs by default (DISABLE_WORKER to opt-out)
- [x] BullMQ job processing
- [x] Scheduled SMS processor
- [x] Follow-up automation
- [x] Notification queue

### Integrations ✅
- [x] n8n webhook workflows
- [x] Twilio SMS (alphanumeric sender IDs)
- [x] Vapi voice calls
- [x] Google Calendar (placeholder for future)
- [x] Email notifications (SMTP)

## Performance Optimization

### Database ✅
- [x] Indexes on frequently queried fields
- [x] Appointment conflict detection index
- [x] Connection pooling (Prisma)
- [x] Query optimization with selective includes

### Caching ✅
- [x] Redis for job queue
- [x] React Query for frontend caching
- [x] Stale-while-revalidate strategy

### Frontend ✅
- [x] Code splitting with Vite
- [x] Lazy loading for routes
- [x] Optimized bundle size (862KB main, 11KB vendor)
- [x] Image optimization
- [x] CSS minification

## Monitoring & Logging

### Error Tracking ✅
- [x] Sentry integration (backend & frontend)
- [x] Structured error logging
- [x] Audit trail for all actions

### Health Checks ✅
- [x] `/api/health` endpoint
- [x] Database connectivity check
- [x] Redis connectivity check
- [x] System status dashboard

### Metrics to Monitor 📊
- [x] API response times (via Sentry)
- [x] Database query performance (via Prisma Metrics)
- [x] Redis queue depth (via Dashboard)
- [x] SMS delivery rates (via Reports)
- [x] Voice call success rates (via Reports)
- [x] Appointment booking conversion (via Analytics)
- [x] Recovery case success rate (via Analytics)

## Testing

### Manual Testing ✅
- [x] User registration and login
- [x] Password reset flow
- [x] Appointment booking (all channels)
- [x] Double-booking prevention
- [x] SMS sending and receiving
- [x] Voice call handling
- [x] Calendar view
- [x] Recovery analytics
- [x] Role-based permissions

### Load Testing 🔄
- [ ] Concurrent appointment bookings
- [ ] High-volume SMS processing
- [ ] Multiple simultaneous voice calls
- [ ] Dashboard with large datasets

## Post-Deployment

### Immediate Checks ✅
1. Visit `/api/health` - should return 200 OK
2. Check system status in dashboard
3. Test public booking page
4. Verify SMS sending works
5. Check worker logs for errors
6. Monitor Sentry for exceptions

### First 24 Hours 📅
- [ ] Monitor error rates
- [ ] Check SMS delivery success
- [ ] Verify appointment reminders sent
- [ ] Review audit logs
- [ ] Check Redis queue processing
- [ ] Monitor database performance

### First Week 📅
- [ ] Review recovery analytics
- [ ] Check user feedback
- [ ] Monitor API usage patterns
- [ ] Optimize slow queries
- [ ] Review security logs
- [ ] Plan feature improvements

## Backup & Recovery

### Database Backups ✅
- [ ] Daily automated backups (Supabase/Neon handles this)
- [ ] Test restore procedure
- [ ] Document recovery steps

### Disaster Recovery Plan 📋
1. Database restore from backup
2. Redeploy backend from git
3. Redeploy frontend from git
4. Verify environment variables
5. Run health checks
6. Notify users if needed

## Documentation

### User Documentation ✅
- [x] Public booking instructions
- [x] Dashboard user guide (in-app)
- [x] SMS conversation flow
- [x] Voice call handling

### Technical Documentation ✅
- [x] API endpoints documented
- [x] Database schema (Prisma)
- [x] Webhook integration guide
- [x] Double-booking prevention system
- [x] Environment variables guide

## Compliance

### GDPR / Privacy — legal gate
- [ ] Privacy policy reviewed for the actual production data flows
- [ ] Article 28 DPA reviewed/approved where ClinicFlow acts as processor
- [ ] Subprocessor list documented
- [ ] Data retention/deletion process documented
- [ ] Data-subject request process documented
- [x] Audit logging

### Healthcare (if applicable) 🏥
- [ ] HIPAA compliance review (if US-based)
- [ ] Data encryption at rest and in transit
- [ ] Access control and audit trails
- [ ] Patient data retention policies

## Support & Maintenance

### Support Channels 📞
- [ ] Set up support email
- [ ] Create user documentation
- [ ] Set up status page
- [ ] Define SLA for critical issues

### Maintenance Schedule 🔧
- [ ] Weekly: Review error logs
- [ ] Monthly: Security updates
- [ ] Quarterly: Performance review
- [ ] Annually: Security audit

## Success Metrics 📈

### Key Performance Indicators
- Appointment booking rate
- Recovery case success rate
- SMS delivery success rate
- Voice call completion rate
- User satisfaction score
- System uptime (target: 99.9%)
- API response time (target: <200ms p95)

---

## Quick Start Commands

### Development
```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Production
```bash
# Backend
cd backend
npm install
npx prisma migrate deploy
npm start

# Frontend
cd frontend
npm install
npm run build
# Deploy dist/ folder
```

### Health Check
```bash
curl https://your-backend.com/api/health
```

---

**Last Updated**: 2026-09-23
**Version**: 1.1.0
**Status**: Pre-launch gate — not a legal/compliance certification
