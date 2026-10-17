-- Test/demo appointments must not collide with real appointments at the same slot.
ALTER TABLE "Appointment"
    ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "unique_doctor_slot";
DROP INDEX IF EXISTS "unique_doctor_slot";

CREATE UNIQUE INDEX "unique_doctor_slot"
    ON "Appointment" ("clinicId", "doctorId", "startTime", "status", "isTest");
