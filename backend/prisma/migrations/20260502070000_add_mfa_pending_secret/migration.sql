-- Store encrypted MFA setup secrets until the user verifies their first TOTP code.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaPendingSecret" TEXT;
