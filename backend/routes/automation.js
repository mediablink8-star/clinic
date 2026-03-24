const express = require('express');
const router = express.Router();
const asyncHandler = require('../middleware/asyncHandler');
const { handleMissedCall, processScheduledMissedCalls, markRecovered } = require('../services/missedCallService');
const { getDueNotifications, processNotification } = require('../services/notificationService');

/**
 * All responses follow:
 *   SUCCESS: { success: true, data: { ... } }
 *   FAILURE: { error: { code, message } }  (via global error handler + AppError)
 */

/**
 * POST /api/automation/missed-call
 * Ingest a new missed call and trigger recovery workflow.
 *
 * Body: { phone, clinicId, callSid? }
 *
 * Example response:
 *   { "success": true, "data": { "missedCallId": "abc123" } }
 *   { "success": true, "data": { "missedCallId": "abc123", "scheduled": true, "scheduledAt": "..." } }
 *   { "success": true, "data": { "duplicate": true, "missedCallId": "abc123" } }
 */
router.post('/missed-call', asyncHandler(async (req, res) => {
    const { phone, clinicId, callSid } = req.body;

    if (!phone || !clinicId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'phone and clinicId are required' } });
    }

    const { data } = await handleMissedCall({ phone, clinicId, callSid });
    res.json({ success: true, data });
}));

/**
 * POST /api/automation/process-missed-calls
 * Process all missed calls that are scheduled and now due.
 * Called by n8n/Make on a schedule instead of the internal cron.
 *
 * Body: {} (no params needed)
 *
 * Example response:
 *   { "success": true, "data": { "processed": 3 } }
 */
router.post('/process-missed-calls', asyncHandler(async (req, res) => {
    const processed = await processScheduledMissedCalls();
    res.json({ success: true, data: { processed } });
}));

/**
 * GET /api/automation/pending-notifications
 * Returns all notifications that are SCHEDULED and due now.
 * n8n/Make polls this, then calls /send-notification for each.
 *
 * Example response:
 *   { "success": true, "data": [{ "id": "notif_abc" }, ...] }
 */
router.get('/pending-notifications', asyncHandler(async (req, res) => {
    const notifications = await getDueNotifications();
    res.json({ success: true, data: notifications });
}));

/**
 * POST /api/automation/send-notification
 * Process and deliver a single notification by ID.
 * Called by n8n/Make after polling /pending-notifications.
 *
 * Body: { notificationId }
 *
 * Example response:
 *   { "success": true, "data": {} }
 *   { "success": false, "data": { "reason": "Already processed" } }
 */
router.post('/send-notification', asyncHandler(async (req, res) => {
    const { notificationId } = req.body;

    if (!notificationId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'notificationId is required' } });
    }

    const result = await processNotification(notificationId);
    res.json({ success: result.success, data: result.reason ? { reason: result.reason } : {} });
}));

/**
 * POST /api/automation/mark-recovered
 * Mark a missed call as RECOVERED after the patient booked an appointment.
 * Called by n8n/Make at the end of a recovery workflow.
 *
 * Body: { clinicId, missedCallId }
 *
 * Example response:
 *   { "success": true, "data": { "missedCallId": "abc123", "status": "RECOVERED" } }
 */
router.post('/mark-recovered', asyncHandler(async (req, res) => {
    const { clinicId, missedCallId } = req.body;

    if (!clinicId || !missedCallId) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'clinicId and missedCallId are required' } });
    }

    const { data } = await markRecovered({ clinicId, missedCallId });
    res.json({ success: true, data });
}));

module.exports = router;
