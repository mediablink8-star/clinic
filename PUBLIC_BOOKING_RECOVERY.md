# Public Booking Link - Recovery Tracking

## Overview

The public booking link now supports **recovery tracking** - when a patient books through a link sent via SMS after a missed call, the system automatically:

1. ✅ Creates the appointment
2. ✅ Marks the missed call as RECOVERED
3. ✅ Updates revenue metrics
4. ✅ Links the appointment to the missed call

## How It Works

### SMS Recovery Flow

1. **Patient misses a call** → System creates `MissedCall` record with status `DETECTED`
2. **AI sends SMS** with booking link → Status changes to `RECOVERING`
3. **Patient clicks link** → Opens public booking page
4. **Patient books appointment** → System:
   - Creates appointment
   - Marks `MissedCall` as `RECOVERED`
   - Sets `recoveredAt` timestamp
   - Calculates revenue using `clinic.aiConfig.avgAppointmentValue`
   - Links appointment to missed call via `appointmentId`

### URL Format

**Without recovery tracking** (general public link):
```
https://clinicflows.vercel.app/book?clinicId=abc123
```

**With recovery tracking** (sent in SMS):
```
https://clinicflows.vercel.app/book?clinicId=abc123&missedCallId=xyz789
```

The `missedCallId` parameter tells the system which missed call this booking is recovering.

## Database Changes

### New Field: `MissedCall.appointmentId`

```sql
ALTER TABLE "MissedCall" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "MissedCall" ADD CONSTRAINT "MissedCall_appointmentId_fkey" 
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id");
```

This creates a link between the missed call and the appointment that recovered it.

### Schema Update

```prisma
model MissedCall {
  // ... existing fields
  appointmentId    String?
  appointment      Appointment?     @relation(fields: [appointmentId], references: [id])
  // ...
}

model Appointment {
  // ... existing fields
  missedCalls     MissedCall[]      // Reverse relation
  // ...
}
```

## Revenue Calculation

Revenue is calculated using the clinic's configured `avgAppointmentValue`:

```javascript
// From clinic.aiConfig
const avgAppointmentValue = clinic.aiConfig.avgAppointmentValue || 80; // default 80€

// When booking is linked to missed call
await prisma.missedCall.update({
    where: { id: missedCallId },
    data: {
        status: 'RECOVERED',
        estimatedRevenue: avgAppointmentValue,
        appointmentId: appointment.id
    }
});
```

## Dashboard Metrics

The dashboard shows:

- **AI Recovery Revenue (€X)** - Sum of `estimatedRevenue` for all `RECOVERED` missed calls
- **Recovered Count** - Number of missed calls with status `RECOVERED`
- **Recovery Rate** - `(recovered / total missed calls) × 100`

These metrics now update automatically when patients book through the recovery link.

## SMS Template Example

When sending recovery SMS, include both parameters:

```
Γεια σας! Χάσατε μια κλήση στο ιατρείο μας. 
Κλείστε ραντεβού εδώ: 
https://clinicflows.vercel.app/book?clinicId={CLINIC_ID}&missedCallId={MISSED_CALL_ID}
```

## Testing

### Test Recovery Flow

1. Create a test missed call (use Dashboard → Test Recovery button)
2. Get the `missedCallId` from the recovery log
3. Open booking link with both parameters:
   ```
   /book?clinicId=YOUR_CLINIC_ID&missedCallId=MISSED_CALL_ID
   ```
4. Complete the booking
5. Check Dashboard → Revenue should increase
6. Check Recovery Log → Status should show "RECOVERED"

### Test Regular Booking

1. Open booking link without `missedCallId`:
   ```
   /book?clinicId=YOUR_CLINIC_ID
   ```
2. Complete the booking
3. Appointment is created but revenue doesn't change (no missed call to recover)

## Migration Instructions

1. **Run the migration**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Verify schema**:
   ```bash
   npx prisma db pull
   ```

3. **Check the new field exists**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'MissedCall' AND column_name = 'appointmentId';
   ```

## Backward Compatibility

- ✅ Old booking links (without `missedCallId`) still work
- ✅ Appointments created without `missedCallId` are treated as regular bookings
- ✅ Existing missed calls are not affected
- ✅ Revenue metrics continue to work for old data

## API Changes

### POST `/api/public/book`

**New optional parameter**:
```json
{
  "clinicId": "abc123",
  "name": "John Doe",
  "phone": "+306912345678",
  "date": "2026-05-10",
  "time": "14:30",
  "missedCallId": "xyz789"  // ← NEW: Optional recovery tracking
}
```

**Response** (unchanged):
```json
{
  "success": true,
  "data": {
    "appointmentId": "appt_123"
  }
}
```

## Monitoring

Check backend logs for recovery tracking:

```
[PUBLIC BOOKING] Created appointment: {
  id: 'appt_123',
  clinicId: 'clinic_abc',
  patientName: 'John Doe',
  linkedMissedCall: 'mc_xyz'  // ← Shows recovery link
}

[PUBLIC BOOKING] Marked missed call mc_xyz as RECOVERED with revenue €80
```

## Files Changed

- `backend/prisma/schema.prisma` - Added `appointmentId` to MissedCall
- `backend/prisma/migrations/20260506100000_link_missed_call_to_appointment/migration.sql` - Migration
- `backend/services/publicService.js` - Recovery logic
- `backend/services/validationService.js` - Added `missedCallId` validation
- `backend/routes/public.js` - Pass `missedCallId` to service
- `frontend/src/pages/PatientBooking.jsx` - Extract and send `missedCallId` from URL
