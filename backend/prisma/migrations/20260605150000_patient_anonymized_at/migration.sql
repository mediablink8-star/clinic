-- GDPR right-to-be-forgotten support.
-- anonymizedAt is set when a patient has been anonymized via DELETE /api/clinic/patients/:id
-- anonymizedBy captures the user ID that triggered the anonymization for audit

ALTER TABLE "Patient" ADD COLUMN "anonymizedAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "anonymizedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Patient_clinicId_anonymizedAt_idx"
ON "Patient" ("clinicId", "anonymizedAt");
