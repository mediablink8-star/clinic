-- Add unique constraint to prevent double-booking at the database level
CREATE UNIQUE INDEX "unique_doctor_slot" ON "Appointment"("clinicId", "doctorId", "startTime", "status");
