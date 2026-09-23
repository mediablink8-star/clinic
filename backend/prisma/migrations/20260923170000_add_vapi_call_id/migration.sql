ALTER TABLE "MissedCall" ADD COLUMN IF NOT EXISTS "vapiCallId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "MissedCall_vapiCallId_key" ON "MissedCall"("vapiCallId");
