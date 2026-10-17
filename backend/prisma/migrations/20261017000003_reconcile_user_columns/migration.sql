-- Bring User account/security fields into line with the current Prisma model.
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "mfaPendingSecret" TEXT;

ALTER TABLE "User" ALTER COLUMN "clinicId" DROP NOT NULL;
