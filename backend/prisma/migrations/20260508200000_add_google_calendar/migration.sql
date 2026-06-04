-- Add Google Calendar integration fields to Clinic
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "googleCalendarRefreshToken" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "googleCalendarEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add Google Calendar event ID to Appointment for deletion tracking
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;
