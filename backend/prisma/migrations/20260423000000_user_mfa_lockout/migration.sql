-- Add MFA and account lockout fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaEnabled"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaSecret"      TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil"    TIMESTAMP(3);

-- Add avatarUrl and timezone to Clinic
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "avatarUrl"    TEXT DEFAULT 'https://images.unsplash.com/photo-1516542077369-bc831dfb1b17?q=80&w=1000';
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "timezone"     TEXT NOT NULL DEFAULT 'Europe/Athens';
