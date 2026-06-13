-- CreateEnum
CREATE TYPE "RecoveryCaseState" AS ENUM ('ACTIVE', 'ENGAGED', 'RECOVERED', 'CLOSED_NO_RESPONSE', 'CLOSED_OPTED_OUT');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RECEIVED');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('MISSED_CALL_DETECTED', 'OUTBOUND_SMS_QUEUED', 'OUTBOUND_SMS_SENT', 'OUTBOUND_SMS_DELIVERED', 'OUTBOUND_SMS_FAILED', 'INBOUND_SMS_RECEIVED', 'PATIENT_REPLIED', 'CASE_RECOVERED', 'CASE_CLOSED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "RecoveryCase" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "missedCallId" TEXT,
    "patientPhone" TEXT NOT NULL,
    "state" "RecoveryCaseState" NOT NULL DEFAULT 'ACTIVE',
    "recoveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "clinicPhone" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "body" TEXT,
    "fromPhone" TEXT,
    "toPhone" TEXT,
    "providerMessageSid" TEXT,
    "providerStatusRaw" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "queuedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "type" "ActivityEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RecoveryCase_missedCallId_key" ON "RecoveryCase"("missedCallId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_recoveryCaseId_key" ON "Conversation"("recoveryCaseId");
CREATE UNIQUE INDEX IF NOT EXISTS "Message_providerMessageSid_key" ON "Message"("providerMessageSid");

CREATE INDEX IF NOT EXISTS "RecoveryCase_clinicId_state_lastActivityAt_idx" ON "RecoveryCase"("clinicId", "state", "lastActivityAt");
CREATE INDEX IF NOT EXISTS "RecoveryCase_clinicId_patientPhone_idx" ON "RecoveryCase"("clinicId", "patientPhone");
CREATE INDEX IF NOT EXISTS "RecoveryCase_clinicId_createdAt_idx" ON "RecoveryCase"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "RecoveryCase_patientId_idx" ON "RecoveryCase"("patientId");
CREATE INDEX IF NOT EXISTS "Conversation_clinicId_lastMessageAt_idx" ON "Conversation"("clinicId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "Conversation_clinicId_patientPhone_idx" ON "Conversation"("clinicId", "patientPhone");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_clinicId_status_createdAt_idx" ON "Message"("clinicId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_clinicId_direction_createdAt_idx" ON "Message"("clinicId", "direction", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_clinicId_createdAt_idx" ON "ActivityEvent"("clinicId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_recoveryCaseId_createdAt_idx" ON "ActivityEvent"("recoveryCaseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_clinicId_type_createdAt_idx" ON "ActivityEvent"("clinicId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecoveryCase" ADD CONSTRAINT "RecoveryCase_missedCallId_fkey" FOREIGN KEY ("missedCallId") REFERENCES "MissedCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_recoveryCaseId_fkey" FOREIGN KEY ("recoveryCaseId") REFERENCES "RecoveryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
