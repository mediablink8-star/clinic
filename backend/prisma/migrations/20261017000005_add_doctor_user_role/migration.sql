-- The Prisma Role enum includes DOCTOR, but the original database enum did not.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DOCTOR';
