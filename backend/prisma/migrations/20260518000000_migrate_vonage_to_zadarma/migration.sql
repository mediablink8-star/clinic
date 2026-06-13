-- Migrate from Vonage to Zadarma + Twilio architecture
-- Vonage is replaced by Zadarma (VoIP/SIP trunk for Vapi) and Twilio (SMS)

-- Drop old Vonage columns
ALTER TABLE "Clinic" DROP COLUMN IF EXISTS "vonageApiKey";
ALTER TABLE "Clinic" DROP COLUMN IF EXISTS "vonageApiSecret";
ALTER TABLE "Clinic" DROP COLUMN IF EXISTS "vonageFromName";

-- Add Zadarma columns (for SIP trunk / phone numbers used with Vapi)
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaApiKey" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaApiSecret" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaPhoneNumber" TEXT;
