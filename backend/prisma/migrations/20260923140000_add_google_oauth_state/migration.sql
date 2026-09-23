-- Add Google OAuth state used during the clinic Google Calendar OAuth flow.
-- This column is referenced by googleCalendarService.js and must exist in production
-- databases before the OAuth endpoints or scheduler jobs access it.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "googleOAuthState" TEXT;
