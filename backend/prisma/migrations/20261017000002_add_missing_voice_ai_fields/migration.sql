-- Voice AI provider configuration fields present in the Prisma Clinic model.
ALTER TABLE "Clinic"
    ADD COLUMN IF NOT EXISTS "vapiAssistantId" TEXT,
    ADD COLUMN IF NOT EXISTS "vapiPhoneNumberId" TEXT,
    ADD COLUMN IF NOT EXISTS "vapiCredentialId" TEXT,
    ADD COLUMN IF NOT EXISTS "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT;
