-- Soft-deleted, cancelled, and no-show appointments must release their slot.
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "unique_doctor_slot";
DROP INDEX IF EXISTS "unique_doctor_slot_active";

-- Fail clearly instead of arbitrarily mutating historical appointments if
-- legacy data contains duplicate active slots.
DO $
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Appointment" a
    JOIN "Appointment" b
      ON a."clinicId" = b."clinicId"
      AND a."doctorId" = b."doctorId"
      AND a."startTime" = b."startTime"
      AND a.id < b.id
    WHERE a."doctorId" IS NOT NULL
      AND a."deletedAt" IS NULL
      AND b."deletedAt" IS NULL
      AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
      AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
  ) THEN
    RAISE EXCEPTION 'Duplicate active appointment slots exist; reconcile them before applying active-slot uniqueness';
  END IF;
END $;

CREATE UNIQUE INDEX "unique_doctor_slot_active"
  ON "Appointment" ("clinicId", "doctorId", "startTime")
  WHERE "deletedAt" IS NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW');
