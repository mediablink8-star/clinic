-- Track asynchronous Google Calendar synchronization separately from appointment creation.
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleCalendarSyncStatus" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "googleCalendarSyncError" TEXT;
