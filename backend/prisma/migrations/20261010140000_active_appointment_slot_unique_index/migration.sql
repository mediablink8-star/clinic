-- Soft-deleted appointments must release their doctor/time slot.
-- Keep the database-level guard for active appointments regardless of status.
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "unique_doctor_slot";

CREATE UNIQUE INDEX "unique_doctor_slot_active"
  ON "Appointment" ("clinicId", "doctorId", "startTime")
  WHERE "deletedAt" IS NULL;
