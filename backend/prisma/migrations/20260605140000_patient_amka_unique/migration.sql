-- Add partial unique constraint on Patient (clinicId, amka)
-- Partial so that NULL amka values (existing patients without AMKA) are
-- still allowed. The encryption service uses non-deterministic encryption
-- (IV per row), so we cannot use a deterministic index on the encrypted
-- ciphertext. Enforce uniqueness in application code via a pre-check in
-- patientService.createPatient/updatePatient against the decrypted value.

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_clinicId_amka_key"
ON "Patient" ("clinicId", "amka")
WHERE "amka" IS NOT NULL;
