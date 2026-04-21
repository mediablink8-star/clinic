-- Add Bland AI fields to Clinic
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "blandApiKey"         TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "blandPhoneNumberId"  TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "blandVoiceId"        TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "voiceEnabled"        BOOLEAN NOT NULL DEFAULT false;
