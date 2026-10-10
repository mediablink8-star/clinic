-- Keep the database schema aligned with the Clinic model used by onboarding.
-- Existing clinics predate this flag and must not be forced through the new-clinic
-- wizard during deployment. New clinic rows keep the schema default of false.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Clinic'
          AND column_name = 'onboardingCompleted'
    ) THEN
        ALTER TABLE "Clinic"
            ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
        UPDATE "Clinic" SET "onboardingCompleted" = true;
    END IF;
END $$;
