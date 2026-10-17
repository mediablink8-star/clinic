-- Keep the fresh database schema aligned with Prisma's Clinic model.
ALTER TABLE "Clinic"
    ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
