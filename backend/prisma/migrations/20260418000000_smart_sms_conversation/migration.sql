-- Add conversation state machine fields to MissedCall
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "conversationState" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "bookingStep"       TEXT;
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "bookingDay"        TEXT;
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "followUp1SentAt"   TIMESTAMP(3);
ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "followUp2SentAt"   TIMESTAMP(3);

-- Index for follow-up cron queries
CREATE INDEX IF NOT EXISTS "MissedCall_followup_idx" ON "MissedCall"("clinicId", "conversationState", "lastSmsSentAt");
