# Requirements Document

## Introduction

This feature enables full end-to-end testing of the missed-call recovery flow using an external workflow tool (n8n, Make, or similar) instead of internal cron jobs. The backend must be fully drivable via HTTP endpoints so that the complete sequence — missed call detected → SMS processed → notification sent → recovery marked — can be simulated and verified without manual database edits or real telephony.

The feature adds no new UI, no new database fields, and no new business logic. It exposes and hardens existing automation endpoints, adds test-mode support for simulated call IDs, and enforces full observability so every state transition is visible and debuggable.

## Glossary

- **Automation_API**: The set of HTTP endpoints under `/api/automation/*` used by external workflow tools
- **MissedCall**: A Prisma model representing a detected missed phone call and its recovery state
- **Notification**: A Prisma model representing a scheduled outbound message to be delivered
- **MessageLog**: A Prisma model recording the outcome of each message delivery attempt
- **Recovery_Flow**: The full sequence: record missed call → process SMS → send notification → mark recovered
- **External_Workflow**: An automation tool (n8n, Make, etc.) that drives the Recovery_Flow by calling Automation_API endpoints
- **Test_CallSid**: A `callSid` value prefixed with `test_` (e.g. `test_12345`) used to simulate a missed call without real telephony
- **smsStatus**: A field on MissedCall tracking SMS delivery state: `pending | processing | sent | failed | scheduled`
- **Automation_Auth**: The `automationAuth` middleware that accepts either an `x-api-key` header or a Bearer JWT

---

## Requirements

### Requirement 1: Record Missed Call via Automation Endpoint

**User Story:** As an external workflow, I want to POST a missed call to the backend, so that a MissedCall record is created and I receive enough information to drive the next step.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/automation/missed-call` with a valid `phone` and `clinicId`, THE Automation_API SHALL create a MissedCall record and return `{ success: true, data: { missedCallId, smsStatus, scheduledSmsAt } }`.
2. WHEN the request includes a `callSid` that already exists for the same `clinicId`, THE Automation_API SHALL return `{ success: true, data: { duplicate: true, missedCallId } }` without creating a new record.
3. WHEN the missed call is created outside configured working hours, THE Automation_API SHALL set `smsStatus` to `scheduled` and populate `scheduledSmsAt` with the next working-hours start time.
4. WHEN the missed call is created within configured working hours, THE Automation_API SHALL set `smsStatus` to `pending`.
5. IF `phone` or `clinicId` is missing from the request body, THEN THE Automation_API SHALL return HTTP 400 with `{ error: { code: "VALIDATION_ERROR", message: "..." } }`.
6. IF the `clinicId` does not match an existing clinic, THEN THE Automation_API SHALL return HTTP 404 with `{ error: { code: "NOT_FOUND", message: "Clinic not found" } }`.

---

### Requirement 2: Test-Mode Simulation via Test CallSid

**User Story:** As a developer testing the recovery flow, I want to use a `callSid` prefixed with `test_` so that I can simulate a missed call without real telephony infrastructure.

#### Acceptance Criteria

1. WHEN a POST to `/api/automation/missed-call` includes a `callSid` with the prefix `test_`, THE Automation_API SHALL accept and process the request identically to a real call.
2. WHEN a `test_` callSid is used, THE Automation_API SHALL apply the same deduplication logic as for real callSids.
3. THE Automation_API SHALL NOT require a real Twilio or telephony callSid format for any automation endpoint.

---

### Requirement 3: Process Scheduled Missed Calls

**User Story:** As an external workflow running on a schedule, I want to trigger processing of all due scheduled missed calls, so that SMS delivery happens at the correct time without relying on internal cron.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/automation/process-missed-calls`, THE Automation_API SHALL find all MissedCall records where `smsStatus = 'scheduled'` and `scheduledSmsAt <= now()`.
2. WHEN due records are found, THE Automation_API SHALL call `processScheduledMissedCalls()` and return `{ success: true, data: { processedCount: <number> } }`.
3. WHEN no due records exist, THE Automation_API SHALL return `{ success: true, data: { processedCount: 0 } }`.
4. WHEN a MissedCall is being processed, THE Automation_API SHALL update `smsStatus` to `processing` before attempting delivery and update it to `sent` or `failed` after the attempt completes.
5. IF delivery fails for a MissedCall, THEN THE Automation_API SHALL set `smsStatus` to `failed` and populate `smsError` with a descriptive error message.

---

### Requirement 4: Poll Pending Notifications

**User Story:** As an external workflow, I want to retrieve all notifications that are due for delivery, so that I can process each one individually.

#### Acceptance Criteria

1. WHEN a GET request is sent to `/api/automation/pending-notifications`, THE Automation_API SHALL return all Notification records where `status = 'SCHEDULED'` and `scheduledFor <= now()`.
2. THE Automation_API SHALL return the response in the format `{ success: true, data: [{ id: "..." }, ...] }`.
3. WHEN no notifications are due, THE Automation_API SHALL return `{ success: true, data: [] }`.

---

### Requirement 5: Send a Single Notification

**User Story:** As an external workflow, I want to process and deliver a single notification by ID, so that credits are deducted, a MessageLog is created, and the Notification status is updated.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/automation/send-notification` with a valid `notificationId`, THE Automation_API SHALL deduct one credit from the clinic, create a MessageLog record, attempt delivery via webhook, and update the Notification `status` to `SENT`.
2. WHEN the Notification has already been processed (status is not `SCHEDULED` or `ENQUEUED`), THE Automation_API SHALL return `{ success: false, data: { reason: "Already processed" } }` without re-processing.
3. IF the clinic has insufficient `messageCredits`, THEN THE Automation_API SHALL return HTTP 403 with `{ error: { code: "INSUFFICIENT_CREDITS", message: "..." } }`.
4. IF the clinic has reached `dailyMessageCap`, THEN THE Automation_API SHALL return HTTP 429 with `{ error: { code: "DAILY_CAP_REACHED", message: "..." } }`.
5. IF delivery fails, THEN THE Automation_API SHALL set the MessageLog `status` to `FAILED` and populate `error` with the failure reason.
6. IF `notificationId` is missing from the request body, THEN THE Automation_API SHALL return HTTP 400 with `{ error: { code: "VALIDATION_ERROR", message: "notificationId is required" } }`.

---

### Requirement 6: Mark Missed Call as Recovered

**User Story:** As an external workflow, I want to mark a missed call as recovered after the patient books an appointment, so that the recovery funnel reflects the correct final state.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/automation/mark-recovered` with a valid `clinicId` and `missedCallId`, THE Automation_API SHALL update `MissedCall.status` to `RECOVERED` and return `{ success: true, data: { missedCallId, status: "RECOVERED" } }`.
2. WHEN `mark-recovered` is called, THE Automation_API SHALL record the recovery timestamp in `MissedCall.recoveredAt`.
3. IF the `missedCallId` does not exist or does not belong to the given `clinicId`, THEN THE Automation_API SHALL return HTTP 404 with `{ error: { code: "NOT_FOUND", message: "MissedCall not found" } }`.
4. IF `clinicId` or `missedCallId` is missing from the request body, THEN THE Automation_API SHALL return HTTP 400 with `{ error: { code: "VALIDATION_ERROR", message: "..." } }`.

---

### Requirement 7: Authentication for All Automation Endpoints

**User Story:** As a system operator, I want all automation endpoints to require authentication, so that only authorized workflow tools or authenticated users can trigger recovery operations.

#### Acceptance Criteria

1. THE Automation_Auth SHALL accept an `x-api-key` header matching the `AUTOMATION_API_KEY` environment variable as valid authentication.
2. THE Automation_Auth SHALL accept a valid Bearer JWT token as valid authentication.
3. IF neither a valid `x-api-key` nor a valid Bearer JWT is present, THEN THE Automation_Auth SHALL return HTTP 401 with `{ error: { code: "UNAUTHORIZED", message: "Missing authentication" } }`.
4. IF `AUTOMATION_API_KEY` is not configured on the server and an `x-api-key` is provided, THEN THE Automation_Auth SHALL return HTTP 401 with `{ error: { code: "NO_API_KEY_CONFIGURED", message: "..." } }`.

---

### Requirement 8: Full Observability — No Silent Failures

**User Story:** As a developer debugging the recovery flow, I want every state transition to be persisted to the database, so that I can inspect the exact status of any step without guessing.

#### Acceptance Criteria

1. THE Automation_API SHALL update `MissedCall.smsStatus` at every stage of SMS processing: `pending → processing → sent | failed`.
2. WHEN an SMS delivery attempt fails, THE Automation_API SHALL populate `MissedCall.smsError` with the error message from the failed attempt.
3. THE Automation_API SHALL update `Notification.status` to reflect each transition: `SCHEDULED → ENQUEUED → SENT | FAILED`.
4. THE Automation_API SHALL set `MessageLog.status` to `SENT` on successful delivery and `FAILED` on failed delivery.
5. THE Automation_API SHALL NOT leave any MissedCall or Notification in a `processing` or `ENQUEUED` state without subsequently updating it to a terminal state (`sent`, `failed`, `SENT`, `FAILED`).

---

### Requirement 9: End-to-End Workflow Drivability

**User Story:** As a QA engineer, I want to run the complete missed-call recovery simulation using only HTTP calls to the Automation_API, so that I can verify the full flow without manual database edits or real telephony.

#### Acceptance Criteria

1. THE Automation_API SHALL support the following complete sequence using only HTTP calls: POST `/missed-call` → POST `/process-missed-calls` → GET `/pending-notifications` → POST `/send-notification` → POST `/mark-recovered`.
2. WHEN the full sequence completes successfully, THE Automation_API SHALL result in a MissedCall with `status = RECOVERED`, a Notification with `status = SENT`, and a MessageLog with `status = SENT`.
3. THE Automation_API SHALL allow a `test_` prefixed `callSid` at step 1 so that no real telephony infrastructure is required to run the simulation.

---

### Requirement 10: Idempotent Notification Processing

**User Story:** As an external workflow that may retry on failure, I want repeated calls to `/send-notification` with the same `notificationId` to be safe, so that credits are never double-charged.

#### Acceptance Criteria

1. WHEN a POST request is sent to `/api/automation/send-notification` with a `notificationId` that has already been processed (status is not `SCHEDULED` or `ENQUEUED`), THE Automation_API SHALL return `{ success: false, data: { reason: "Already processed" } }` without deducting credits or creating a duplicate MessageLog.
2. THE Automation_API SHALL check the Notification status before any credit deduction or delivery attempt.
3. Idempotency SHALL be enforced using the existing Notification `status` field — no additional fields or tables are required.

---

### Requirement 11: Workflow Retry Safety

**User Story:** As an external workflow tool that retries failed steps, I want all automation endpoints to be safe to call multiple times, so that a mid-execution failure never leaves the system in a corrupted state.

#### Acceptance Criteria

1. ALL Automation_API endpoints SHALL be safe to retry — calling the same endpoint with the same inputs more than once SHALL NOT produce duplicate records, double-charged credits, or inconsistent state.
2. WHEN `/api/automation/missed-call` is retried with the same `callSid` and `clinicId`, THE Automation_API SHALL return the existing record (deduplication) rather than creating a new one.
3. WHEN `/api/automation/mark-recovered` is called on an already-recovered MissedCall, THE Automation_API SHALL return success without error.
4. WHEN `/api/automation/process-missed-calls` is called and some records are already in `processing` state, THE Automation_API SHALL skip those records and not re-process them.

---

### Requirement 12: Automation Endpoint Performance

**User Story:** As an operator running an external workflow, I want automation endpoints to respond within a predictable time window, so that workflow tools do not time out during normal operation.

#### Acceptance Criteria

1. ALL Automation_API endpoints SHOULD complete and return a response within 5 seconds under normal load.
2. WHEN an operation is expected to take longer than 5 seconds (e.g. bulk SMS processing), THE Automation_API SHALL initiate the operation asynchronously and return an immediate acknowledgement response.
3. THE Automation_API SHALL NOT block the HTTP response while waiting for external delivery confirmations (e.g. Twilio callbacks).

---

### Requirement 13: Test Data Isolation

**User Story:** As a developer running simulated test flows, I want records created with a `test_` callSid to be identifiable as test data, so that they do not pollute production analytics or dashboards.

#### Acceptance Criteria

1. WHEN a MissedCall is created with a `callSid` prefixed `test_`, THE Automation_API MAY flag the record as test data using an existing or derivable field (e.g. by inspecting the `callSid` prefix at query time).
2. Analytics and reporting queries SHOULD be filterable to exclude records where `callSid` starts with `test_`.
3. Test records SHALL follow the same processing rules as real records — they are not skipped or short-circuited in any way.
4. No new database fields are required to implement test data identification — the `callSid` prefix is sufficient as the identifier.
