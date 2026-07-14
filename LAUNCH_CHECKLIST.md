# ClinicFlow SaaS - 10/10 Launch Checklist

## ✅ Completed (Code Changes Made)

### Critical Fixes
- [x] **Fixed `appointmentService.js` bug** - `dateStr`/`timeStr` variables now properly defined in `sendConfirmationSms` (line 523-524)

### Test Infrastructure (NEW)
- [x] **Backend test setup** - `tests/setup.js` with Prisma test client, factories, helpers
- [x] **Jest configuration** - `jest.config.js` with coverage thresholds (50%), proper test matching
- [x] **Integration tests**:
  - `tests/integration/auth.test.js` - Login, register, refresh, MFA, rate limiting
  - `tests/integration/appointments.test.js` - CRUD, double-booking prevention, role-based access
  - `tests/integration/recovery.test.js` - Missed calls, SMS conversations, webhook flows, RBAC
- [x] **Unit tests**:
  - `tests/unit/aiCommandService.test.js` - Prompt injection protection, command parsing, execution
  - `tests/unit/appointmentService.test.js` - Timezone handling, conflict detection, soft deletes
  - `tests/unit/slotUtils.test.js` - Slot generation, working hours, edge cases
  - `tests/unit/encryptionService.test.js` - AES-256-GCM, tamper detection, unicode support
  - `tests/unit/recoveryTrackingService.test.js` - State machine, callbacks, backfill
- [x] **Frontend test setup** - `vitest.config.js`, `src/test/setup.js`
- [x] **Frontend component tests**:
  - `src/components/AiAssistant.test.jsx`
  - `src/components/NewAppointmentModal.test.jsx`
  - `src/pages/Dashboard.test.jsx`

### API Versioning
- [x] **Version header middleware** - `middleware/apiVersion.js` with `API-Version` response header
- [x] **Applied to all `/api` routes** in `index.js`

### CI/CD Pipeline (ENHANCED)
- [x] **`.github/workflows/ci.yml`** - Full pipeline:
  - Backend lint + unit + integration tests (parallel)
  - Frontend lint + test + build
  - Security audit (npm audit high)
  - Docker build for both services
  - Staging deploy on `develop` branch
  - Production deploy on `main` branch

### Docker Test Environment
- [x] **`docker-compose.test.yml`** - Postgres + Redis + test runner
- [x] **`backend/Dockerfile.test`** - Test-specific container
- [x] **`scripts/setup-test-db.sh`** - Automated test DB setup

---

## 🟡 High Priority (Do Before Launch)

### 1. Stripe Billing Portal & Metered Billing
```javascript
// backend/routes/billing.js - ADD
router.post('/portal', requireAuth, requireRole('OWNER'), asyncHandler(async (req, res) => {
  const session = await stripe.billingPortal.sessions.create({
    customer: clinic.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/settings/billing`,
  });
  res.json({ url: session.url });
}));

// Metered usage reporting
router.post('/report-usage', requireAuth, asyncHandler(async (req, res) => {
  const { metric, quantity } = req.body; // metric: 'sms_sent' | 'ai_requests'
  await stripe.subscriptionItems.createUsageRecord(
    clinic.stripeSubscriptionItemId,
    { quantity, timestamp: Math.floor(Date.now() / 1000), action: 'increment' }
  );
  res.json({ success: true });
}));
```

### 2. Webhook Retry + Dead Letter Queue
```javascript
// backend/services/webhookService.js - ENHANCE triggerWebhook
async function triggerWebhook(event, payload, clinicId, secret, options = {}) {
  const maxRetries = 3;
  const backoff = [1000, 5000, 30000];
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const delivery = await prisma.webhookDelivery.create({
      data: { clinicId, eventType: event, targetUrl, payload: JSON.stringify(payload) }
    });
    
    try {
      const response = await fetch(targetUrl, { /* ... */ });
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { success: response.ok, httpStatus: response.status, attempts: attempt + 1 }
      });
      if (response.ok) return { success: true };
    } catch (err) {
      if (attempt === maxRetries) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { success: false, error: err.message, deadLetter: true }
        });
      }
      await sleep(backoff[attempt]);
    }
  }
}
```

### 3. Prometheus Metrics + Grafana Dashboards
```javascript
// backend/utils/metrics.js - NEW FILE
const promClient = require('prom-client');

const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const appointmentsBooked = new promClient.Counter({
  name: 'appointments_booked_total',
  help: 'Appointments booked',
  labelNames: ['clinic_id', 'source']
});

const recoveryRate = new promClient.Gauge({
  name: 'recovery_rate_percent',
  help: 'Recovery rate by clinic',
  labelNames: ['clinic_id']
});

// Add to index.js
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

### 4. Admin Impersonation + Clinic Management
```javascript
// backend/routes/admin.js - ADD
router.get('/clinics', requireAdmin, asyncHandler(async (req, res) => {
  const clinics = await prisma.clinic.findMany({
    include: {
      _count: { select: { users: true, patients: true, appointments: true }},
      subscriptionEvents: { take: 1, orderBy: { createdAt: 'desc' }}
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ data: clinics });
}));

router.post('/clinics/:id/impersonate', requireAdmin, asyncHandler(async (req, res) => {
  const token = generateImpersonationToken(req.params.id, req.user.userId);
  res.json({ token, expiresIn: '1h' });
}));
```

### 5. Patient Booking Page SEO + reCAPTCHA
```jsx
// frontend/src/pages/PatientBooking.jsx - ENHANCE
useEffect(() => {
  document.title = `${clinic?.name} - Κλείσε Ραντεβού Online`;
  // Add JSON-LD for Google Rich Results
  const schema = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    "name": clinic.name,
    "telephone": clinic.phone,
    "address": clinic.location,
    "url": window.location.href,
  };
}, [clinic]);

// Add reCAPTCHA v3 on submit
```

### 6. GDPR Export/Delete
```javascript
// backend/routes/clinic.js - ADD
router.post('/gdpr/export', requireAuth, requireRole('OWNER'), asyncHandler(async (req, res) => {
  const data = await exportAllClinicData(req.clinicId);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${Date.now()}.json"`);
  res.send(JSON.stringify(data, null, 2));
}));

router.post('/gdpr/delete', requireAuth, requireRole('OWNER'), asyncHandler(async (req, res) => {
  await anonymizeClinicData(req.clinicId);
  res.json({ success: true, message: 'Δεδομένα ανωνυμοποιήθηκαν' });
}));
```

---

## 🟢 Medium Priority (Week 2-3)

| Feature | Effort | Impact |
|---------|--------|--------|
| i18n (Greek/English) | 2 days | Market expansion |
| Onboarding wizard completion | 2 days | Activation rate |
| Sentry release tracking + sourcemaps | 1 day | Debugging speed |
| Load testing (k6) | 1 day | Confidence |
| Backup/restore verification | 1 day | Disaster recovery |
| API rate limit per-clinic (not global) | 1 day | Fair usage |

---

## 🔵 Polish (Week 3-4)

- [ ] Cookie consent banner (GDPR)
- [ ] Terms of Service / Privacy Policy pages
- [ ] Email templates (HTML + text)
- [ ] Dark mode polish (Tailwind v4 migration)
- [ ] Mobile PWA manifest + service worker
- [ ] Accessibility audit (WCAG 2.1 AA)

---

## 📋 Pre-Launch Verification

### Run Commands
```bash
# Backend tests
cd backend && npm run test:ci

# Frontend tests
cd frontend && npm run test:ci

# E2E (add Cypress)
npm run test:e2e

# Security audit
cd backend && npm audit --audit-level=high
cd frontend && npm audit --audit-level=high

# Load test
k6 run load-test.js

# Docker build
docker-compose -f docker-compose.test.yml build
docker-compose -f docker-compose.test.yml run backend-test
```

### Manual QA Checklist
- [ ] Register new clinic → complete onboarding → book appointment
- [ ] Missed call → SMS sent → patient replies → appointment booked
- [ ] Voice AI call → appointment created
- [ ] Double-booking attempt blocked
- [ ] Trial expiry → billing lock → upgrade flow
- [ ] MFA enable/disable
- [ ] Admin impersonation
- [ ] GDPR export/delete
- [ ] Webhook retry (simulate 500 → 200)

---

## 🚀 Launch Day

1. **Staging smoke test** - Full flow on staging
2. **DNS switch** - Point `clinicflow.app` to production
3. **Monitor** - Grafana + Sentry for first 4 hours
4. **Rollback plan** - `docker-compose down && docker-compose up -d` previous images
5. **Post-launch** - Check error rates, recovery rates, billing webhooks

---

## 📊 Success Metrics (First 30 Days)

| Metric | Target |
|--------|--------|
| Uptime | >99.9% |
| Error rate | <0.1% |
| Recovery rate | >25% |
| Trial → Paid | >15% |
| Support tickets/day | <5 |
| p95 API latency | <500ms |