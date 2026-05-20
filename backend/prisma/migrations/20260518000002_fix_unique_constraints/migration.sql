-- Add indexes for performance
CREATE INDEX "Appointment_clinicId_doctorId_startTime_endTime_status_idx" ON "Appointment"("clinicId", "doctorId", "startTime", "endTime", "status");

-- Fix Patient phone uniqueness
DROP INDEX IF EXISTS "Patient_clinicId_phone_key";
CREATE UNIQUE INDEX "Patient_clinicId_phone_key" ON "Patient"("clinicId", "phone");
