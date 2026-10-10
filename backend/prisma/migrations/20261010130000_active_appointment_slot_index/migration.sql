-- Replace the old unconditional index. It blocked slot reuse after soft deletion
-- and incorrectly treated different appointment statuses as separate slots.
DROP INDEX IF EXISTS "unique_doctor_slot";
DROP INDEX IF EXISTS "unique_doctor_slot_active";

-- Do not silently choose which appointment to keep if legacy data already contains
-- duplicate active slots. Fail migration clearly so the operator can reconcile them.
DO $$
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
END $$;

CREATE UNIQUE INDEX "unique_doctor_slot_active"
  ON "Appointment" ("clinicId", "doctorId", "startTime")
  WHERE "deletedAt" IS NULL AND "status" NOT IN ('CANCELLED', 'NO_SHOW');
