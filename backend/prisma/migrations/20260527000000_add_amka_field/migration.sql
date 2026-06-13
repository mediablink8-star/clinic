-- Add AMKA (Greek social security number) field to Patient model
-- Visible only to OWNER role in the frontend

ALTER TABLE "Patient" ADD COLUMN "amka" TEXT;
