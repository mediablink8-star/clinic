-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('MANUAL', 'PUBLIC_LINK', 'SMS_BOOKING', 'CALL_BOOKING', 'AI_VOICE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "patientName" TEXT,
    "phone" TEXT,
    "appointmentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedEvent_clinicId_createdAt_idx" ON "FeedEvent"("clinicId", "createdAt");
CREATE INDEX "FeedEvent_clinicId_type_createdAt_idx" ON "FeedEvent"("clinicId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_source_createdAt_idx" ON "Appointment"("clinicId", "source", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedEvent" ADD CONSTRAINT "FeedEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
