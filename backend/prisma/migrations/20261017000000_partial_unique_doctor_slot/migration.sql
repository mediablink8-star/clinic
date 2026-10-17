-- Soft-deleted appointments must not block rebooking the same slot.
-- The earlier exact-slot index predates the soft-delete column.
DROP INDEX IF EXISTS "unique_doctor_slot";

CREATE UNIQUE INDEX "unique_doctor_slot"
    ON "Appointment"("clinicId", "doctorId", "startTime", "status")
    WHERE "deletedAt" IS NULL;
