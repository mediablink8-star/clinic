-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "workingHours" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "doctorId" TEXT;

-- CreateIndex
CREATE INDEX "Doctor_clinicId_idx" ON "Doctor"("clinicId");

-- CreateIndex
CREATE INDEX "Doctor_clinicId_isActive_idx" ON "Doctor"("clinicId", "isActive");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
