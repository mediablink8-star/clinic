-- Add index on patientId for MissedCall table

CREATE INDEX IF NOT EXISTS "MissedCall_patientId_idx" ON "MissedCall" ("patientId");