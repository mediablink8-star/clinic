-- The plan field is present in schema.prisma and used by the following
-- pricing migration, but was missing from the original SQL migration.
ALTER TABLE "Clinic"
    ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'trial';
