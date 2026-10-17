-- Align legacy MissedCall columns with the current recovery workflow model.
ALTER TABLE "MissedCall"
    ADD COLUMN IF NOT EXISTS "appointmentId" TEXT,
    ADD COLUMN IF NOT EXISTS "vapiCallId" TEXT,
    ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "conversationState" TEXT NOT NULL DEFAULT 'NEW',
    ADD COLUMN IF NOT EXISTS "bookingStep" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingDay" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingName" TEXT,
    ADD COLUMN IF NOT EXISTS "followUp1SentAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "followUp2SentAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "optedOut" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "totalContactAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "MissedCall_vapiCallId_key" ON "MissedCall"("vapiCallId");
