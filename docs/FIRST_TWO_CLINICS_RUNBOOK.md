# First Two Clinics — Controlled Pilot Runbook

This runbook is for the first two real clinics. The goal is controlled onboarding, fast detection of failures, and safe rollback — not feature expansion.

## Before importing real patient data

### Business / privacy gate
- Confirm the clinic understands what ClinicFlow will process.
- Confirm the production privacy notice and contractual/data-processing documents have been reviewed appropriately.
- Document subprocessors and data flows.
- Do not claim legal “full GDPR compliance” based solely on software controls.
- Define how patient-data deletion/export requests will be handled.

GDPR Article 28 requires processor arrangements to cover the processing subject matter, duration, nature/purpose, data categories, data-subject categories, and processor obligations. Article 32 requires risk-appropriate security measures, including confidentiality/integrity/availability, restoration capability, and regular testing. Review the official EU regulation before finalizing legal documents.

## Clinic configuration
1. Create the clinic and owner account.
2. Confirm timezone is Europe/Athens unless the clinic explicitly uses another timezone.
3. Add doctors and verify active/inactive status.
4. Configure working hours, holidays, services, policies and appointment duration.
5. Connect Google Calendar if the clinic wants calendar synchronization.
6. Configure the production phone/SMS/voice provider.
7. Verify voiceEnabled is OFF until the voice smoke test passes.
8. Verify the clinic master isActive switch works.
9. Create one test patient and delete/anonymize it after testing.

## Required smoke test
- Login and logout.
- Owner/admin permissions.
- MFA enrollment and login.
- Password reset.
- Create/edit/delete a test patient.
- Create, reschedule and cancel a test appointment.
- Attempt two simultaneous bookings for the same slot; only one may succeed.
- Public booking.
- Missed call creates the correct recovery case.
- Vapi callback modifies only the intended recovery case.
- SMS sends and its provider SID/status is recorded.
- Inbound SMS attaches to the correct clinic/patient/recovery case.
- STOP and START opt-out behavior.
- Google Calendar success path.
- Google Calendar failure path: appointment remains visible and sync status shows failure.
- Scheduled worker job.
- /api/health is healthy.
- Sentry receives a deliberate test error.
- Set voiceEnabled=false and confirm voice recovery falls back safely.
- Set clinic isActive=false and confirm access/workflows are stopped as intended.

## Go-live procedure
### Phase 1 — controlled traffic
For the first clinic, enable only the workflows actually tested:
- appointments
- SMS recovery
- voice recovery only after the voice test passes
- calendar sync only after the calendar test passes

Keep the clinic's normal reception process available as a fallback.

### Phase 2 — first live day
Monitor errors/Sentry, API health, worker health, SMS delivery, Vapi calls, calendar sync failures, appointment conflicts, and recovery cases.
Do not make unrelated production code changes while the clinic is actively using the system unless required for an incident.

### Phase 3 — first 24 hours
Review failed jobs, failed SMS, failed calendar sync, unexpected AI behavior, incorrect patient/case associations, audit logs, and database/Redis health.
Repeat the same process for clinic #2 only after clinic #1 has completed the controlled smoke test successfully.

## Emergency rollback
1. Disable the clinic using the master isActive control.
2. Disable voiceEnabled if the issue involves AI calling.
3. Revoke/disable the affected provider credential if necessary.
4. Preserve logs and affected IDs/timestamps.
5. Fix and test in a non-production environment.
6. Re-enable the clinic only after the relevant smoke test passes.

## Success criteria
A clinic is successfully onboarded when real appointments can be managed reliably, recovery events remain tenant-isolated, no unapproved cross-clinic data is visible, SMS/voice/calendar failures are visible rather than silent, backups are known to exist and a restore procedure is documented, the clinic knows how to reach support, and the privacy/contractual gate has been completed appropriately.

This is an operational launch checklist, not a legal certification.