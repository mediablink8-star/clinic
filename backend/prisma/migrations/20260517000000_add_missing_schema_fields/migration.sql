-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "workingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Clinic"
ADD COLUMN IF NOT EXISTS "vapiAssistantId" TEXT,
ADD COLUMN IF NOT EXISTS "vapiPhoneNumberId" TEXT,
ADD COLUMN IF NOT EXISTS "vapiCredentialId" TEXT,
ADD COLUMN IF NOT EXISTS "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "geminiApiKey" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarRefreshToken" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "googleOAuthState" TEXT,
ADD COLUMN IF NOT EXISTS "smsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "aiRequestCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lastResetDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "smsMonthlyLimit" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "mfaPendingSecret" TEXT,
ALTER COLUMN "clinicId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "doctorId" TEXT,
ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;

-- AlterTable
ALTER TABLE "MissedCall"
ADD COLUMN IF NOT EXISTS "appointmentId" TEXT,
ADD COLUMN IF NOT EXISTS "conversationState" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN IF NOT EXISTS "bookingStep" TEXT,
ADD COLUMN IF NOT EXISTS "bookingDay" TEXT,
ADD COLUMN IF NOT EXISTS "bookingName" TEXT,
ADD COLUMN IF NOT EXISTS "followUp1SentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "followUp2SentAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "optedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "totalContactAttempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "RecoveryCase" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "missedCallId" TEXT,
    "patientPhone" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "recoveredAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecoveryCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "clinicPhone" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "recoveryCaseId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Doctor_clinicId_idx" ON "Doctor"("clinicId");
CREATE INDEX "Doctor_clinicId_isActive_idx" ON "Doctor"("clinicId", "isActive");
CREATE UNIQUE INDEX "MissedCall_appointmentId_key" ON "MissedCall"("appointmentId");
CREATE UNIQUE INDEX "RecoveryCase_missedCallId_key" ON "RecoveryCase"("missedCallId");
CREATE INDEX "RecoveryCase_clinicId_state_lastActivityAt_idx" ON "RecoveryCase"("clinicId", "state", "lastActivityAt");
CREATE INDEX "RecoveryCase_clinicId_patientPhone_idx" ON "RecoveryCase"("clinicId", "patientPhone");
CREATE INDEX "RecoveryCase_clinicId_createdAt_idx" ON "RecoveryCase"("clinicId", "createdAt");
CREATE INDEX "RecoveryCase_patientId_idx" ON "RecoveryCase"("patientId");
CREATE UNIQUE INDEX "Conversation_recoveryCaseId_key" ON "Conversation"("recoveryCaseId");
CREATE INDEX "Conversation_clinicId_lastMessageAt_idx" ON "Conversation"("clinicId", "lastMessageAt");
CREATE INDEX "Conversation_clinicId_patientPhone_idx" ON "Conversation"("clinicId", "patientPhone");
CREATE UNIQUE INDEX "Message_providerMessageSid_key" ON "Message"("providerMessageSid");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_clinicId_status_createdAt_idx" ON "Message"("clinicId", "status", "createdAt");
CREATE INDEX "Message_clinicId_direction_createdAt_idx" ON "Message"("clinicId", "direction", "createdAt");
CREATE INDEX "ActivityEvent_clinicId_createdAt_idx" ON "ActivityEvent"("clinicId", "createdAt");
CREATE INDEX "ActivityEvent_recoveryCaseId_createdAt_idx" ON "ActivityEvent"("recoveryCaseId", "createdAt");
CREATE INDEX "ActivityEvent_clinicId_type_createdAt_idx" ON "ActivityEvent"("clinicId", "type", "createdAt");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
