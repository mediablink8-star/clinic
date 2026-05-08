-- Add opt-out tracking and contact attempt counting to MissedCall
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "optedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "totalContactAttempts" INTEGER NOT NULL DEFAULT 0;

-- Add opt-out tracking at the patient level (phone-level opt-out)
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "optedOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "optedOutAt" TIMESTAMP(3);
