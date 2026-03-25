# Implementation Plan: Workflow-Driven Recovery

## Overview

Six targeted fixes to `automation.js`, `missedCallService.js`, and `notificationService.js`. No new files, no schema changes. Each task closes a specific gap identified in the design.

## Tasks

- [x] 1. Apply `automationAuth` middleware to the automation router
  - Add `router.use(automationAuth)` at the top of `backend/routes/automation.js`, before any route definitions
  - Add the corresponding `require` for `automationAuth` if not already imported
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 1.1 Write property test for authentication on all endpoints
    - **Property 9: Authentication rejects unauthenticated requests on all endpoints**
    - For each of the five automation routes, send a request with no `x-api-key` and no `Authorization` header and assert HTTP 401 with `{ error: { code: "UNAUTHORIZED" } }`
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - `// Feature: workflow-driven-recovery, Property 9: authentication rejects unauthenticated requests on all endpoints`

- [x] 2. Fix `handleMissedCall` response shape
  - In `backend/services/missedCallService.js`, update the return value of `handleMissedCall` so the non-duplicate path returns `{ missedCallId, smsStatus, scheduledSmsAt }` instead of `{ missedCallId, scheduled, scheduledAt }`
  - Both the scheduled (OOH) and within-hours paths must return `smsStatus` and `scheduledSmsAt`
  - _Requirements: 1.1, 1.3, 1.4_

  - [ ]* 2.1 Write property test for smsStatus at creation reflecting working hours
    - **Property 2: smsStatus at creation reflects working hours**
    - Generate a clinic with known working hours; call `handleMissedCall` with a timestamp inside working hours and assert `smsStatus = 'pending'`, `scheduledSmsAt = null`; call again outside working hours and assert `smsStatus = 'scheduled'`, `scheduledSmsAt` is a future time
    - **Validates: Requirements 1.3, 1.4**
    - `// Feature: workflow-driven-recovery, Property 2: smsStatus at creation reflects working hours`

  - [ ]* 2.2 Write property test for missed call creation idempotency
    - **Property 1: Missed call creation is idempotent on callSid**
    - Generate random `phone`, `clinicId`, and `callSid` (including `test_`-prefixed variants); call `handleMissedCall` twice with the same inputs; assert both calls return the same `missedCallId` and the DB contains exactly one record with that `callSid`
    - **Validates: Requirements 1.2, 2.2, 11.2**
    - `// Feature: workflow-driven-recovery, Property 1: missed call creation is idempotent on callSid`

- [x] 3. Fix `process-missed-calls` response key and skip `processing` records
  - In `backend/routes/automation.js`, change the response from `{ processed }` to `{ processedCount }` using the return value of `processScheduledMissedCalls()`
  - In `backend/services/missedCallService.js`, update the `findMany` query in `processScheduledMissedCalls` to exclude records where `smsStatus = 'processing'` (add `smsStatus: { not: 'processing' }` or use the existing `scheduled` filter — confirm the query already filters to `scheduled` only, which implicitly skips `processing`)
  - _Requirements: 3.1, 3.2, 3.3, 11.4_

  - [ ]* 3.1 Write property test for process-missed-calls only processing due scheduled records
    - **Property 4: process-missed-calls only processes due scheduled records**
    - Seed a mix of `scheduled` (due), `scheduled` (not yet due), and `processing` records; call `processScheduledMissedCalls()`; assert `processedCount` equals only the count of due `scheduled` records, `processing` records are untouched, and not-yet-due records are untouched
    - **Validates: Requirements 3.1, 3.2, 11.4**
    - `// Feature: workflow-driven-recovery, Property 4: process-missed-calls only processes due scheduled records`

  - [ ]* 3.2 Write property test for smsStatus reaching terminal state after processing
    - **Property 3: smsStatus always reaches a terminal state after processing**
    - Seed `MissedCall` records with `smsStatus = 'scheduled'` and `scheduledSmsAt` in the past; mock `triggerWebhook` to succeed or fail randomly; call `processScheduledMissedCalls()`; assert every processed record has `smsStatus` of `sent` or `failed`, and `failed` records have non-null `smsError`
    - **Validates: Requirements 3.4, 3.5, 8.1, 8.2, 8.5**
    - `// Feature: workflow-driven-recovery, Property 3: smsStatus always reaches a terminal state after processing`

- [ ] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 5. Fix `markRecovered` to set `recoveredAt` and be idempotent
  - In `backend/services/missedCallService.js`, update `markRecovered` to:
    1. If the record already has `status = 'RECOVERED'`, return `{ success: true, data: { missedCallId, status: 'RECOVERED' } }` without updating (idempotent path)
    2. Otherwise, include `recoveredAt: new Date()` in the `update` data alongside `status: 'RECOVERED'`
  - _Requirements: 6.1, 6.2, 11.3_

  - [ ]* 5.1 Write property test for mark-recovered idempotency and recoveredAt
    - **Property 8: mark-recovered sets status and recoveredAt, and is idempotent**
    - Generate a `MissedCall` in any non-recovered state; call `markRecovered`; assert `status = 'RECOVERED'` and `recoveredAt` is set; call again; assert the response is still success and `recoveredAt` is unchanged
    - **Validates: Requirements 6.1, 6.2, 11.3**
    - `// Feature: workflow-driven-recovery, Property 8: mark-recovered sets status and recoveredAt, and is idempotent`

- [x] 6. Verify notification service correctness properties
  - No code changes needed for `notificationService.js` — confirm `processNotification` already handles idempotency, credit checks, and terminal state updates correctly by reviewing against the design
  - _Requirements: 5.1, 5.2, 8.3, 8.4, 8.5, 10.1_

  - [ ]* 6.1 Write property test for notification processing idempotency
    - **Property 6: Notification processing is idempotent**
    - Generate a `Notification` with status `SENT` or `FAILED`; record clinic `messageCredits` and `MessageLog` count; call `processNotification(id)`; assert result is `{ success: false, reason: "Already processed" }`, `messageCredits` unchanged, no new `MessageLog` created
    - **Validates: Requirements 5.2, 10.1, 11.1**
    - `// Feature: workflow-driven-recovery, Property 6: notification processing is idempotent`

  - [ ]* 6.2 Write property test for notification delivery reaching terminal state
    - **Property 7: Notification delivery updates all state atomically and terminally**
    - Generate a `SCHEDULED` notification; mock `triggerWebhook` to succeed or fail randomly; call `processNotification`; assert `Notification.status` is `SENT` or `FAILED`, `MessageLog.status` matches, and neither is left in `PENDING` or `ENQUEUED`
    - **Validates: Requirements 5.1, 5.5, 8.3, 8.4, 8.5**
    - `// Feature: workflow-driven-recovery, Property 7: notification delivery updates all state atomically and terminally`

  - [ ]* 6.3 Write property test for pending notifications filter
    - **Property 5: Pending notifications filter returns only due scheduled records**
    - Seed notifications with various statuses and `scheduledFor` times; call `getDueNotifications()`; assert every returned record has `status = 'SCHEDULED'` and `scheduledFor <= now`, and no non-qualifying records are included
    - **Validates: Requirements 4.1, 4.2**
    - `// Feature: workflow-driven-recovery, Property 5: pending notifications filter returns only due scheduled records`

  - [ ]* 6.4 Write property test for notification concurrency safety
    - **Property 10: Notification processing is concurrency-safe**
    - Simulate two concurrent calls to `processNotification(id)` on the same `SCHEDULED` notification using `Promise.all`; assert exactly one call returns `{ success: true }`, the other returns `{ success: false, reason: "Already processed" }`, exactly one `MessageLog` exists, and `messageCredits` was decremented exactly once
    - **Validates: Requirements 10.1, 10.2, 11.1**
    - `// Feature: workflow-driven-recovery, Property 10: notification processing is concurrency-safe`

- [ ] 7. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` with a minimum of 100 iterations per property
- Each property test comment must include `// Feature: workflow-driven-recovery, Property N: <text>`
- All changes are confined to `backend/routes/automation.js` and `backend/services/missedCallService.js`
- `notificationService.js` requires no code changes — task 6 is verification + tests only
