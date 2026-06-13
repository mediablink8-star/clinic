-- Add per-clinic Vonage credentials (stored encrypted)
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vonageApiKey"    TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vonageApiSecret" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vonageFromName"  TEXT;
