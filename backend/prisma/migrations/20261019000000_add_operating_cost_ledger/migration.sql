-- Per-clinic and platform-wide operating cost ledger. Amounts are stored as integer EUR cents.
CREATE TABLE IF NOT EXISTS "OperatingCost" (
  "id" TEXT NOT NULL,
  "clinicId" TEXT,
  "category" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'eur',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatingCost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperatingCost_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OperatingCost_clinicId_occurredAt_idx" ON "OperatingCost"("clinicId", "occurredAt");
CREATE INDEX IF NOT EXISTS "OperatingCost_category_occurredAt_idx" ON "OperatingCost"("category", "occurredAt");
CREATE INDEX IF NOT EXISTS "OperatingCost_occurredAt_idx" ON "OperatingCost"("occurredAt");
