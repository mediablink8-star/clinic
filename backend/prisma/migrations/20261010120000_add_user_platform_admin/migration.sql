-- Platform administrator support exists in schema.prisma but had no SQL migration.
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
