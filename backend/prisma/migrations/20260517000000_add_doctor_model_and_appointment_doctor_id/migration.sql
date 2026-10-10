-- The Doctor model and Appointment.doctorId exist in schema.prisma but were
-- missing from the migration history. Keep this migration idempotent so it can
-- repair databases where these objects were created out-of-band as well.
CREATE TABLE IF NOT EXISTS "Doctor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "workingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "workingHours" JSONB;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "doctorId" TEXT;

CREATE INDEX IF NOT EXISTS "Doctor_clinicId_idx" ON "Doctor"("clinicId");
CREATE INDEX IF NOT EXISTS "Doctor_clinicId_isActive_idx" ON "Doctor"("clinicId", "isActive");
CREATE INDEX IF NOT EXISTS "Appointment_clinicId_doctorId_startTime_endTime_status_idx"
    ON "Appointment"("clinicId", "doctorId", "startTime", "endTime", "status");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Doctor_clinicId_fkey') THEN
        ALTER TABLE "Doctor"
            ADD CONSTRAINT "Doctor_clinicId_fkey"
            FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Appointment_doctorId_fkey') THEN
        ALTER TABLE "Appointment"
            ADD CONSTRAINT "Appointment_doctorId_fkey"
            FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
