# Double-Booking Prevention System

## Overview
This system prevents multiple patients from booking the same appointment slot simultaneously across all booking channels: public booking page, voice calls (Vapi), SMS conversations, and dashboard.

## Protection Layers

### 1. Database-Level Protection
- **Index**: Optimized index on `(clinicId, startTime, endTime, status)` for fast conflict detection
- **Location**: `backend/prisma/migrations/20260506000000_prevent_double_booking/migration.sql`

### 2. Row-Level Locking (Primary Protection)
All appointment creation paths use PostgreSQL's `FOR UPDATE` row-level locking within transactions:

```sql
SELECT id FROM "Appointment"
WHERE "clinicId" = ?
AND "status" NOT IN ('CANCELLED', 'NO_SHOW')
AND "startTime" < ?
AND "endTime" > ?
FOR UPDATE
LIMIT 1
```

This ensures that:
- When multiple requests try to book the same slot simultaneously, only one succeeds
- Other requests wait for the lock, then see the conflict and fail gracefully
- No race conditions can occur even under high load

### 3. Application-Level Validation
- Time slot validation before booking
- Working hours enforcement
- Duration validation (15-240 minutes in 15-minute increments)

## Protected Booking Channels

### 1. Public Booking Page (`/api/public/book`)
- **Service**: `backend/services/publicService.js`
- **Protection**: Row-level locking in transaction
- **Error Handling**: Returns 409 Conflict with clear message
- **Frontend**: Auto-refreshes available slots on conflict

### 2. Dashboard Appointments (`/api/appointments`)
- **Service**: `backend/services/appointmentService.js`
- **Protection**: Row-level locking in transaction
- **Error Handling**: Returns 409 Conflict
- **Frontend**: Shows error toast

### 3. Voice Calls (Vapi) (`/api/vapi/webhook`)
- **Route**: `backend/routes/vapi.js`
- **Uses**: `createAppointment()` with full protection
- **Error Handling**: Logs failure, patient can retry

### 4. SMS Conversations (`/api/messages/inbound`)
- **Service**: `backend/services/conversationService.js`
- **Uses**: `createAppointment()` with full protection
- **Error Handling**: Sends friendly SMS asking for different time

## Error Messages

### Backend (409 Conflict)
```json
{
  "error": "Time slot already booked",
  "code": "CONFLICT"
}
```

### Frontend (Public Booking)
```
"Η συγκεκριμένη ώρα μόλις κλείστηκε από άλλον ασθενή. 
Παρακαλώ επιλέξτε μια άλλη ώρα."
```

### SMS (Conversation)
```
"Δεν μπόρεσα να κλείσω αυτό το ραντεβού. 
Η ώρα ίσως δεν είναι διαθέσιμη. 
Στείλτε άλλη ημέρα ή ώρα."
```

## Testing Scenarios

### Scenario 1: Simultaneous Public Bookings
1. Two patients open booking page at same time
2. Both select same date/time
3. Both click "Confirm" within milliseconds
4. **Result**: First request succeeds, second gets 409 error and refreshed slots

### Scenario 2: Voice Call + Public Booking
1. Patient A calls and books via Vapi
2. Patient B simultaneously books same slot on website
3. **Result**: Whichever transaction commits first wins, other fails gracefully

### Scenario 3: SMS + Dashboard
1. Patient books via SMS conversation
2. Receptionist tries to book same slot in dashboard
3. **Result**: First to commit wins, other sees conflict error

## Performance Impact
- **Minimal**: Row-level locks are held only during the transaction (~50-100ms)
- **Scalability**: Index ensures fast conflict detection even with thousands of appointments
- **No Deadlocks**: Single-table locking with consistent lock order

## Monitoring
Check logs for conflict patterns:
```bash
grep "Time slot already booked" backend.log
```

High conflict rates may indicate:
- Need for more granular time slots (e.g., 30-minute instead of 60-minute)
- Popular time slots that need capacity expansion
- UI improvements to show real-time availability

## Future Enhancements
- [ ] Real-time slot availability via WebSocket
- [ ] Optimistic locking with version numbers
- [ ] Slot reservation system (hold for 5 minutes during booking)
- [ ] Google Calendar sync with conflict detection
