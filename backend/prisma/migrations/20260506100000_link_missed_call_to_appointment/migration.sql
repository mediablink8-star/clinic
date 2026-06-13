-- Add appointmentId to MissedCall to track which appointment recovered the missed call
ALTER TABLE "MissedCall" ADD COLUMN "appointmentId" TEXT;

-- Add foreign key constraint
ALTER TABLE "MissedCall" ADD CONSTRAINT "MissedCall_appointmentId_fkey" 
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX "MissedCall_appointmentId_idx" ON "MissedCall"("appointmentId");
