-- Provider correlation fields on MessageLog.
--
-- The Twilio delivery-status callback in index.js looks rows up by
-- providerMessageSid, and the n8n/Make automation routes write
-- appointmentId, toPhone and providerStatusRaw. None of these columns
-- existed, so those writes raised Prisma validation errors (swallowed by
-- the surrounding catch) and Twilio delivery status was never persisted.
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "toPhone" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "providerMessageSid" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "providerStatusRaw" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MessageLog_providerMessageSid_key" ON "MessageLog"("providerMessageSid");
CREATE INDEX IF NOT EXISTS "MessageLog_providerMessageSid_idx" ON "MessageLog"("providerMessageSid");