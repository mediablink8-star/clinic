# Service Level Agreement (SLA)

**Last Updated:** February 19, 2026
**Service Name:** ClinicFlow SaaS

## 1. Introduction
This Service Level Agreement (SLA) outlines the performance and availability standards for the ClinicFlow SaaS platform.

## 2. Uptime Guarantee
- **Availability Target**: 99.9% uptime per calendar month.
- **Excluded**: Scheduled maintenance, force majeure, or issues caused by third-party integrations (e.g., Supabase, Vercel, Google).

## 3. Response Times
- **Critical Issues** (System Down): Initial response within 4 hours.
- **High Priority** (Major feature broken): Initial response within 12 hours.
- **Low Priority** (General questions): Initial response within 48 hours.

## 4. Maintenance Windows
- **Standard Maintenance**: Sunday 02:00 – 05:00 UTC.
- **Urgent Security Patches**: May be applied as needed with minimal notification.

## 5. Data Integrity & Backups
- **Database Backups**: Daily automated backups performed via Supabase.
- **Data Recovery**: Point-in-time recovery available within a 7-day window.

## 6. Security & Observability
- **Error Tracking**: Real-time monitoring via Sentry.
- **Protection**: Rate limiting and JWT-based authentication enforced.
- **Privacy**: Multi-tenancy isolation ensures clinic data is never shared.

---
*Note: This is a living document and may be updated to reflect infrastructure improvements.*
