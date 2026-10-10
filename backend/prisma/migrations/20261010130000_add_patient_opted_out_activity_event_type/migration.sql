-- Record patient opt-outs in the recovery activity timeline.
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'PATIENT_OPTED_OUT';
