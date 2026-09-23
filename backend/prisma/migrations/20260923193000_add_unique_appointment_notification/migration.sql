-- Prevent duplicate notification types for the same appointment.
-- appointmentId is nullable, so notifications not tied to appointments remain unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_appointmentId_type_key"
ON "Notification" ("appointmentId", "type");
