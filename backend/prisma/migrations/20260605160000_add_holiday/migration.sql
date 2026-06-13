-- Holiday calendar for clinic working-hours enforcement
-- Stores Greek public holidays and clinic-specific closure dates
-- A clinic is considered closed (outside hours) on any date in this table

CREATE TABLE "Holiday" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "name" TEXT NOT NULL,
  "nameEn" TEXT,
  "country" TEXT NOT NULL DEFAULT 'GR',
  "source" TEXT NOT NULL DEFAULT 'SEED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Holiday_date_country_key" ON "Holiday"("date", "country");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");
CREATE INDEX "Holiday_country_date_idx" ON "Holiday"("country", "date");
