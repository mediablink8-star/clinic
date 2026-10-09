-- Keep the database schema aligned with the Clinic model used by onboarding.
ALTER TABLE "Clinic"
    ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
