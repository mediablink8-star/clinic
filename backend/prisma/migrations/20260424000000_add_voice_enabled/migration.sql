-- Add voiceEnabled field to Clinic table
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "voiceEnabled" BOOLEAN DEFAULT false;