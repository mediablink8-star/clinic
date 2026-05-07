# SMS Template Update - Booking Links with Recovery Tracking

## Changes Made

Updated the SMS templates to include the public booking link with `missedCallId` parameter for automatic revenue tracking.

## New SMS Format

### Default SMS (Missed Call Recovery)

**Old format** (interactive menu):
```
Γεια 👋 χάσαμε την κλήση σας στο {clinic_name}.
Πώς μπορούμε να βοηθήσουμε?
1️⃣ Ραντεβού  2️⃣ Ερώτηση  3️⃣ Επανάκληση
```

**New format** (direct booking link):
```
Γεια 👋 χάσαμε την κλήση σας στο {clinic_name}.
Κλείστε ραντεβού εδώ: https://clinicflows.vercel.app/book?clinicId=xxx&missedCallId=yyy
```

### Custom SMS Templates

Clinics can customize the SMS in **AI Settings** using these placeholders:

- `{clinic_name}` - Replaced with clinic name
- `{booking_link}` - Replaced with full booking URL including missedCallId

**Example custom template**:
```
Γεια σας! Προσπαθήσαμε να σας καλέσουμε από {clinic_name}.
Κλείστε το ραντεβού σας online: {booking_link}
Ευχαριστούμε!
```

## How It Works

1. **Patient misses call** → System creates `MissedCall` record
2. **SMS is sent** with booking link containing:
   - `clinicId` - Identifies which clinic
   - `missedCallId` - Links booking to this specific missed call
3. **Patient clicks link** → Opens booking page
4. **Patient books** → System automatically:
   - Creates appointment
   - Marks missed call as RECOVERED
   - Updates revenue metrics
   - Links appointment to missed call

## URL Structure

```
https://clinicflows.vercel.app/book?clinicId={CLINIC_ID}&missedCallId={MISSED_CALL_ID}
```

**Parameters**:
- `clinicId` (required) - The clinic's unique ID
- `missedCallId` (optional) - The missed call ID for recovery tracking

## Files Updated

### Backend
- `backend/services/missedCallService.js` - Updated default SMS to include booking link
- `backend/routes/vapi.js` - Added missedCallId to voice fallback SMS

### SMS Template Placeholders
Clinics can configure custom SMS templates in `clinic.aiConfig.smsInitial`:

```json
{
  "aiConfig": {
    "smsInitial": "Γεια! Χάσαμε την κλήση σας στο {clinic_name}. Κλείστε ραντεβού: {booking_link}"
  }
}
```

## Benefits

✅ **Automatic Revenue Tracking** - No manual intervention needed
✅ **Better Patient Experience** - Direct link to booking (no menu navigation)
✅ **Accurate Metrics** - Dashboard shows real recovery revenue
✅ **Customizable** - Clinics can personalize the message
✅ **Backward Compatible** - Old links without missedCallId still work

## Migration Notes

### For Existing Clinics

1. **No action required** - The system will automatically use the new format
2. **Custom SMS templates** - If you have a custom `smsInitial` template, add `{booking_link}` placeholder to include the link
3. **Old missed calls** - Existing missed calls without appointments won't be affected

### For New Clinics

- Default SMS automatically includes the booking link
- Customize in Dashboard → Settings → AI Configuration

## Testing

### Test Recovery Flow

1. Go to Dashboard → Recovery tab
2. Click "Test Recovery" button
3. Check your phone for SMS with booking link
4. Click the link and book an appointment
5. Verify:
   - Appointment appears in Dashboard
   - Missed call status changes to "RECOVERED"
   - Revenue metric increases

### Test Custom Template

1. Go to Dashboard → Settings → AI Configuration
2. Set custom SMS template:
   ```
   Γεια! Χάσαμε την κλήση σας στο {clinic_name}.
   Κλείστε online: {booking_link}
   ```
3. Save and test recovery flow
4. Verify SMS uses your custom template with the link

## SMS Character Count

**Important**: SMS messages over 160 characters are split into multiple messages.

**Default SMS length**: ~120 characters (fits in 1 SMS)
**With booking link**: ~180 characters (2 SMS messages)

**Tip**: Keep custom templates concise to minimize SMS costs.

## Environment Variables

Make sure these are set in your backend:

```bash
FRONTEND_URL=https://clinicflows.vercel.app
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook
VONAGE_API_KEY=your_key
VONAGE_API_SECRET=your_secret
VONAGE_FROM_NAME=YourClinic
```

## Monitoring

Check backend logs for SMS sending:

```
[MISSED CALL] Created missed call: mc_xyz
[MISSED CALL] Sending SMS with booking link: /book?clinicId=abc&missedCallId=mc_xyz
[PUBLIC BOOKING] Created appointment linked to missed call: mc_xyz
[PUBLIC BOOKING] Marked missed call mc_xyz as RECOVERED with revenue €80
```

## Troubleshooting

### SMS doesn't include link
- Check `FRONTEND_URL` environment variable is set
- Verify `missedCall.id` exists in database
- Check backend logs for SMS generation

### Link doesn't track recovery
- Verify `missedCallId` parameter is in URL
- Check missed call status is DETECTED or RECOVERING (not already RECOVERED)
- Run database migration if `appointmentId` column is missing

### Revenue doesn't update
- Verify `clinic.aiConfig.avgAppointmentValue` is set (default: 80€)
- Check missed call was marked as RECOVERED in database
- Refresh dashboard to see updated metrics

## Next Steps

1. **Deploy changes** - Push to production
2. **Run migration** - Add `appointmentId` column to MissedCall table
3. **Test flow** - Create test missed call and book appointment
4. **Monitor metrics** - Watch revenue increase as patients book
5. **Customize SMS** - Update template in AI Settings if desired
