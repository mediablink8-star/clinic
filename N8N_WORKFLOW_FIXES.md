# n8n Workflow Fixes - Production Ready

## Critical Issues Fixed

### 🔴 Issue 1: Workflow 3 Never Calls mark-recovered

**Problem**: After sending SMS successfully, the workflow never notified the backend that SMS was delivered. The `missedCall.smsStatus` stayed in limbo, causing incorrect dashboard stats.

**Fix**: Added new node "Mark SMS Sent" after "Log Success" that calls `/automation/mark-recovered`:

```json
POST {{ $env.BACKEND_API_URL }}/automation/mark-recovered
Headers: x-api-key: {{ $env.AUTOMATION_API_KEY }}
Body: {
  "clinicId": "{{ $node['Set Variables'].json.clinicId }}",
  "missedCallId": "{{ $node['Set Variables'].json.missedCallId }}",
  "smsStatus": "sent",
  "messageId": "{{ $node['Log Success'].json.messageId }}"
}
```

**Impact**: Dashboard recovery stats now accurate from day one.

---

### 🔴 Issue 2: Workflow 1 Truncates SMS to 70 Characters

**Problem**: Appointment confirmation messages were truncated to 70 chars with "..." making them look broken and unprofessional.

**Fix**: 
1. **Removed** truncation nodes: "Message > 70 chars?", "Smart Truncate to 70", "Add Ellipsis"
2. **Shortened** template to fit in single SMS:
   - Old: `Γεια σας {name}, το ραντεβού σας στο {clinic} επιβεβαιώθηκε για {date} στις {time}.` (100+ chars)
   - New: `Ραντεβού επιβεβαιώθηκε: {name}, {date} {time} — {clinic}` (~60 chars)
3. **Added** `type: unicode` to Vonage API call for proper Greek character handling

**Impact**: 
- Messages fit in single SMS (saves costs)
- Professional appearance
- Vonage handles multi-part automatically if needed

---

### 🟡 Issue 3: Workflow 4 "Any Processed?" Branch Goes Nowhere

**Problem**: After processing scheduled missed calls, the workflow checked if any were processed. The true branch (something processed) went nowhere, while false branch polled notifications. This meant notifications only polled when nothing was processed (backwards logic).

**Fix**: Removed the "Any Processed?" check entirely. Now workflow always:
1. Process scheduled missed calls
2. Poll pending notifications (regardless of step 1 result)

**Impact**: Notifications are polled every run, ensuring timely delivery.

---

### 🟡 Issue 4: Workflow 3 Sends Vonage Credentials in Plaintext

**Problem**: Backend sent decrypted `vonageApiKey` and `vonageApiSecret` in webhook payload. These appeared in n8n execution logs.

**Fix**: 
1. **Removed** `vonageApiKey`, `vonageApiSecret`, `vonageFromName` from payload
2. **Use** n8n environment variables instead:
   - `$env.VONAGE_API_KEY`
   - `$env.VONAGE_API_SECRET`
   - `$env.VONAGE_FROM_NAME`

**Impact**: Credentials no longer visible in n8n logs. More secure for multi-clinic setup.

---

### 🟡 Issue 5: Workflow 5 Missing clinicId in Inbound SMS

**Problem**: Inbound SMS forwarded to `/webhook/inbound-sms` without `clinicId`. Backend resolved it by matching `to` number with `clinic.phone`, which failed if formats didn't match exactly (+30 vs 30).

**Status**: Not fixed in workflow (would require clinic lookup in n8n). Instead, verified backend `normalizePhone()` handles both formats.

**Recommendation**: For multi-clinic, add clinic lookup in n8n or ensure phone normalization is bulletproof.

---

## Files Changed

### Updated Workflows
- `backend/n8n/workflow_1_appointment_confirmation.json` - Removed truncation, shortened template
- `backend/n8n/workflow_3_missed_call_recovery.json` - Added mark-recovered call, removed credential passing
- `backend/n8n/workflow_4_scheduled_sms_processor.json` - Removed "Any Processed?" check

### Unchanged Workflows
- `backend/n8n/workflow_0_global_error_handler.json` - No changes needed
- `backend/n8n/workflow_2_direct_sms.json` - No changes needed
- `backend/n8n/workflow_5_inbound_sms_reply.json` - No changes needed (backend handles normalization)

---

## Deployment Instructions

### 1. Import Updated Workflows to n8n

**Option A: Via n8n UI**
1. Go to n8n dashboard
2. Click "Workflows" → "Import from File"
3. Upload each updated JSON file
4. Activate the workflows

**Option B: Via n8n API**
```bash
# For each workflow
curl -X POST https://your-n8n-instance.com/api/v1/workflows \
  -H "X-N8N-API-KEY: your_api_key" \
  -H "Content-Type: application/json" \
  -d @backend/n8n/workflow_3_missed_call_recovery.json
```

### 2. Set Environment Variables in n8n

Add these to your n8n instance:

```bash
# Vonage SMS
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
VONAGE_FROM_NAME=YourClinic

# Backend API
BACKEND_API_URL=https://backend-l9el.onrender.com/api
WEBHOOK_SECRET=your_webhook_secret
AUTOMATION_API_KEY=your_automation_api_key
```

### 3. Update Backend to Remove Credential Passing

The backend should no longer send Vonage credentials in the webhook payload. Update `missedCallService.js`:

```javascript
// OLD - Don't do this
triggerN8n('/missed-call', {
  clinicId,
  missedCallId: missedCall.id,
  phone: normalizedPhone,
  smsBody: smartSmsBody,
  vonageApiKey: decrypt(clinic.vonageApiKey),  // ❌ Remove
  vonageApiSecret: decrypt(clinic.vonageApiSecret),  // ❌ Remove
  vonageFromName: clinic.vonageFromName  // ❌ Remove
});

// NEW - Do this
triggerN8n('/missed-call', {
  clinicId,
  missedCallId: missedCall.id,
  phone: normalizedPhone,
  smsBody: smartSmsBody
});
```

### 4. Test Each Workflow

**Test Workflow 1 (Appointment Confirmation)**:
```bash
curl -X POST https://your-n8n.com/webhook/appointment-created \
  -H "x-webhook-key: your_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "appointmentId": "test_123",
      "phone": "+306912345678",
      "patientName": "Νίκος",
      "date": "15/05",
      "time": "10:00"
    },
    "clinic": {"name": "Ιατρείο Παπαδόπουλου"}
  }'
```

**Test Workflow 3 (Missed Call Recovery)**:
```bash
curl -X POST https://your-n8n.com/webhook/missed-call \
  -H "x-webhook-key: your_secret" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicId": "clinic_123",
    "missedCallId": "mc_456",
    "phone": "+306912345678",
    "smsBody": "Γεια! Χάσαμε την κλήση σας. Κλείστε ραντεβού: https://..."
  }'
```

Check:
- ✅ SMS is sent
- ✅ Backend receives `/automation/mark-recovered` call
- ✅ `missedCall.smsStatus` updates to "sent"
- ✅ Dashboard shows correct stats

**Test Workflow 4 (Scheduled Processor)**:
- Wait for next 5-minute interval
- Check n8n execution logs
- Verify both scheduled calls AND notifications are processed

---

## SMS Template Guidelines

### Appointment Confirmation (Workflow 1)

**Current template** (~60 chars):
```
Ραντεβού επιβεβαιώθηκε: {name}, {date} {time} — {clinic}
```

**Alternative templates** (if you want more detail):

**Option A** (~80 chars, 2 SMS):
```
Γεια {name}! Ραντεβού στο {clinic}: {date} στις {time}. Ευχαριστούμε!
```

**Option B** (~70 chars, 1 SMS):
```
Ραντεβού OK: {name}, {date} {time} @ {clinic}
```

### Missed Call Recovery (Workflow 3)

**Current template** (generated by backend):
```
Γεια 👋 χάσαμε την κλήση σας στο {clinic}.
Κλείστε ραντεβού εδώ: {booking_link}
```

**Character count**: ~120 chars (2 SMS)

**To reduce to 1 SMS** (~70 chars):
```
Χάσαμε την κλήση σας. Κλείστε ραντεβού: {booking_link}
```

---

## Monitoring

### Check Workflow Executions

1. Go to n8n → Executions
2. Filter by workflow name
3. Check for errors or failures

### Check Backend Logs

```bash
# On Render
# Check if mark-recovered is being called
grep "mark-recovered" logs

# Check SMS status updates
grep "smsStatus.*sent" logs
```

### Dashboard Metrics

After deploying, verify:
- ✅ Recovery stats show correct numbers
- ✅ SMS sent count increases
- ✅ Missed calls transition from RECOVERING → RECOVERED
- ✅ Revenue metrics update when patients book

---

## Rollback Plan

If issues occur:

1. **Revert to old workflows**:
   - Keep backup of old JSON files
   - Import old versions via n8n UI

2. **Re-add credentials to payload** (temporary):
   - Uncomment credential passing in `missedCallService.js`
   - Redeploy backend

3. **Check n8n logs** for specific errors

---

## Future Improvements

### Multi-Clinic Support

When adding multiple clinics:

1. **Store Vonage credentials per clinic** in database (encrypted)
2. **Pass credentials in payload** OR **use clinic-specific n8n workflows**
3. **Add clinic lookup** in Workflow 5 for inbound SMS

### SMS Cost Optimization

1. **Track SMS length** in backend before sending
2. **Warn clinics** if custom templates exceed 70 chars
3. **Add SMS cost** to usage tracking

### Better Error Handling

1. **Retry failed SMS** with exponential backoff
2. **Alert admins** when workflows fail repeatedly
3. **Log all SMS** to database for audit trail

---

## Testing Checklist

Before going live:

- [ ] Import all 3 updated workflows to n8n
- [ ] Set all environment variables in n8n
- [ ] Remove credential passing from backend
- [ ] Test Workflow 1 with real phone number
- [ ] Test Workflow 3 with real phone number
- [ ] Verify mark-recovered is called
- [ ] Check dashboard stats are accurate
- [ ] Wait 5 minutes and verify Workflow 4 runs
- [ ] Send test inbound SMS and verify Workflow 5 works
- [ ] Monitor for 24 hours to ensure stability

---

## Support

If you encounter issues:

1. Check n8n execution logs for errors
2. Check backend logs for API call failures
3. Verify environment variables are set correctly
4. Test with curl commands to isolate the issue
5. Check Vonage dashboard for SMS delivery status
