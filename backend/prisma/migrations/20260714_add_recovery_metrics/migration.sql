-- Add patient-level double-booking prevention
-- Partial unique index: one active appointment per patient per start time

-- First, check if any existing data violates this constraint
-- (We only enforce for CONFIRMED/PENDING appointments, not CANCELLED/NO_SHOW/COMPLETED)

-- Create the partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "unique_patient_slot"
ON "Appointment" ("clinicId", "patientId", "startTime", "status")
WHERE "status" IN ('PENDING', 'CONFIRMED');

-- Add webhook secret rotation tracking
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "webhookSecretRotatedAt" TIMESTAMP;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "webhookSecretPrevious" TEXT;

-- Add audit log risk scoring fields
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "riskScore" SMALLINT DEFAULT 0;
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "riskFactors" JSONB DEFAULT '[]';

-- Add reCAPTCHA token field to public booking
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "recaptchaEnabled" BOOLEAN DEFAULT false;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "recaptchaSecretKey" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "recaptchaSiteKey" TEXT;

-- Add per-clinic rate limit tracking
CREATE TABLE IF NOT EXISTS "ClinicRateLimit" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "clinicId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "windowStart" TIMESTAMP NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_clinic_endpoint_window"
ON "ClinicRateLimit" ("clinicId", "endpoint", "windowStart");