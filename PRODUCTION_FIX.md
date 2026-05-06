# Production Fixes - Worker Status & Public Booking

## Issues Fixed

### 1. Worker Status Showing Offline (Εκτός λειτουργίας)

**Problem**: Dashboard showed "Worker Ουράς Εκτός λειτουργίας" despite backend logs confirming workers were running.

**Root Cause**: The `/api/system/status` endpoint was calling `schedulerWorker.isRunning()` and `reminderWorker.isRunning()`, but BullMQ Worker instances don't have an `isRunning()` method.

**Fix**:
- Added `workersRunning` boolean flag in `notificationWorker.js` that tracks worker state
- Set to `true` when workers start successfully, `false` if Redis unavailable
- Exported as `isRunning` getter from the module
- Updated `system.js` to check `_workersModule.isRunning` instead of calling non-existent methods

**Files Changed**:
- `backend/services/notificationWorker.js` - Added workersRunning flag and isRunning export
- `backend/routes/system.js` - Fixed worker status check to use module-level flag

### 2. Public Booking "Either startTime or both date and time are required" Error

**Problem**: Public booking form showed validation error even when date and time were selected.

**Root Cause**: Frontend was sending `date` and `time` fields separately, but the route handler (`backend/routes/public.js`) was only extracting `startTime` from the request body and not passing `date` and `time` to the service.

**Fix**:
- Updated `/api/public/book` route handler to extract `date` and `time` from request body
- Pass both fields to `bookAppointment()` service function
- Service already had logic to handle both formats (startTime OR date+time)

**Files Changed**:
- `backend/routes/public.js` - Added date and time to destructuring and service call

## Deployment Instructions

1. **Push changes to Git**:
   ```bash
   git add backend/services/notificationWorker.js backend/routes/system.js backend/routes/public.js
   git commit -m "fix: worker status detection and public booking validation"
   git push origin main
   ```

2. **Render will auto-deploy** - Wait for deployment to complete (~2-3 minutes)

3. **Verify Fixes**:
   - Dashboard: Check that "Worker Ουράς" shows "✅ Ενεργός" (Active)
   - Public Booking: Test booking at your public link with date/time selection
   - Backend logs should still show: "✅ BullMQ reminder worker started" and "✅ BullMQ scheduler worker started"

## Testing Checklist

- [ ] Dashboard shows worker as active (not "Εκτός λειτουργίας")
- [ ] Public booking accepts date and time selection
- [ ] Public booking creates appointment successfully
- [ ] No "Either startTime or both date and time are required" error
- [ ] Backend logs confirm workers are running
- [ ] Redis connection is active

## Technical Details

### Worker Status Detection
The fix uses a module-level boolean flag instead of trying to call methods on BullMQ Worker instances. This is more reliable because:
- BullMQ workers don't expose an `isRunning()` method
- The flag is set when `startNotificationWorker()` completes successfully
- It accurately reflects whether Redis is available and workers initialized

### Public Booking Validation
The validation schema already supported both formats:
```javascript
// Option 1: ISO timestamp
{ startTime: "2026-05-06T14:30:00.000Z" }

// Option 2: Separate date and time (what frontend sends)
{ date: "2026-05-06", time: "14:30" }
```

The route handler just needed to pass both fields through to the service layer.

## Related Files

- `backend/services/notificationWorker.js` - Worker initialization and status tracking
- `backend/routes/system.js` - System status API endpoint
- `backend/routes/public.js` - Public booking API endpoint
- `backend/services/publicService.js` - Booking logic (already correct)
- `frontend/src/pages/PatientBooking.jsx` - Public booking form (already correct)
