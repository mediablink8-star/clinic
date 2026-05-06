-- Add index to improve conflict detection performance
CREATE INDEX IF NOT EXISTS "idx_appointment_clinic_time_status" 
ON "Appointment"("clinicId", "startTime", "endTime", "status") 
WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW');

-- Add check constraint to ensure appointments don't overlap (enforced at application level)
-- Note: PostgreSQL doesn't support temporal constraints directly, so we rely on application logic
-- This index helps the application-level conflict check run faster
