-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "httpStatus" INTEGER,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebhookDelivery_clinicId_createdAt_idx" ON "WebhookDelivery"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_clinicId_eventType_createdAt_idx" ON "WebhookDelivery"("clinicId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_success_createdAt_idx" ON "WebhookDelivery"("success", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookDelivery_clinicId_eventType_success_createdAt_idx" ON "WebhookDelivery"("clinicId", "eventType", "success", "createdAt");

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
