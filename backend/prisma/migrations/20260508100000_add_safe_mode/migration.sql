-- Add safe mode to Clinic
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "safeMode" BOOLEAN NOT NULL DEFAULT false;
