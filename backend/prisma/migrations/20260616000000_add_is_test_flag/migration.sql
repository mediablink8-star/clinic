-- Add isTest column to Patient, Appointment, and MissedCall tables

ALTER TABLE "Patient" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Appointment" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MissedCall" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;