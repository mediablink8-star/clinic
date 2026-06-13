-- Add Stripe billing fields to Clinic
ALTER TABLE "Clinic"
  ADD COLUMN "stripeCustomerId"      TEXT,
  ADD COLUMN "stripeSubscriptionId"  TEXT,
  ADD COLUMN "planStatus"            TEXT NOT NULL DEFAULT 'trialing',
  ADD COLUMN "trialEndsAt"           TIMESTAMP(3),
  ADD COLUMN "currentPeriodStart"    TIMESTAMP(3),
  ADD COLUMN "currentPeriodEnd"      TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt"           TIMESTAMP(3),
  ADD COLUMN "gracePeriodEndsAt"     TIMESTAMP(3);

CREATE UNIQUE INDEX "Clinic_stripeCustomerId_key" ON "Clinic"("stripeCustomerId");
CREATE UNIQUE INDEX "Clinic_stripeSubscriptionId_key" ON "Clinic"("stripeSubscriptionId");

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id"            TEXT NOT NULL,
    "clinicId"      TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "stripeEventId" TEXT,
    "fromPlan"      TEXT,
    "toPlan"        TEXT,
    "amount"        INTEGER,
    "currency"      TEXT DEFAULT 'eur',
    "metadata"      JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionEvent_stripeEventId_key" ON "SubscriptionEvent"("stripeEventId");
CREATE INDEX "SubscriptionEvent_clinicId_createdAt_idx" ON "SubscriptionEvent"("clinicId", "createdAt");
CREATE INDEX "SubscriptionEvent_clinicId_type_createdAt_idx" ON "SubscriptionEvent"("clinicId", "type", "createdAt");

ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Invoice" (
    "id"                TEXT NOT NULL,
    "clinicId"          TEXT NOT NULL,
    "stripeInvoiceId"   TEXT NOT NULL,
    "number"            TEXT,
    "amountPaid"        INTEGER NOT NULL DEFAULT 0,
    "amountDue"         INTEGER NOT NULL DEFAULT 0,
    "currency"          TEXT NOT NULL DEFAULT 'eur',
    "status"            TEXT NOT NULL,
    "hostedInvoiceUrl"  TEXT,
    "invoicePdf"        TEXT,
    "periodStart"       TIMESTAMP(3),
    "periodEnd"         TIMESTAMP(3),
    "paidAt"            TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");
CREATE INDEX "Invoice_clinicId_createdAt_idx" ON "Invoice"("clinicId", "createdAt");
CREATE INDEX "Invoice_clinicId_status_idx" ON "Invoice"("clinicId", "status");

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clinicId_fkey"
  FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing clinics on the default "trial" plan get a 14-day trial window starting now
UPDATE "Clinic"
SET "trialEndsAt" = NOW() + INTERVAL '14 days',
    "planStatus"  = 'trialing'
WHERE "plan" = 'trial' AND "trialEndsAt" IS NULL;
