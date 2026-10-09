-- These voice/SIP integration fields are part of schema.prisma but were
-- never introduced by a durable migration. Keep the additions idempotent for
-- existing deployments that may already have provisioned them manually.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vapiAssistantId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vapiPhoneNumberId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "vapiCredentialId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaApiKey" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaApiSecret" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "zadarmaPhoneNumber" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "voiceEnabled" BOOLEAN NOT NULL DEFAULT false;
