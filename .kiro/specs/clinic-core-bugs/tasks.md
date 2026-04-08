# Implementation Plan

- [x] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - All Four Core Bug Conditions
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate each bug exists

  - **Bug 1 — Appointment Creation Silently Fails**
    - Scope: `isBugCondition_1(X)` where X is a valid `{ patientId, startTime, endTime, clinicId }`
    - Write a test that calls `POST /api/appointments` with valid data, then calls `GET /api/appointments` and asserts the new appointment ID appears in the response array
    - Run on UNFIXED code — expect the appointment to be MISSING from the list (confirms bug)
    - Root cause to investigate: stale `token` closure in React Query `queryFn` in `App.jsx` — `getHeaders()` captures `token` at render time; after login the `queryFn` may use a stale empty token on refetch
    - Document counterexample: e.g. "POST returns 200 with appointmentId but GET /api/appointments returns [] or omits the new record"
    - _Requirements: 1.1, 1.2_

  - **Bug 2 — Public Booking Shows No Slots**
    - Scope: `isBugCondition_2(X)` where X is `{ clinicId, dateStr }` for a clinic with configured working hours on a weekday
    - Write a test that calls `GET /api/public/clinic/:id/slots?date=YYYY-MM-DD` for a date with no existing appointments and asserts `data.length > 0`
    - Run on UNFIXED code — expect empty array (confirms bug)
    - Root cause to investigate: `getAvailableSlots` in `publicService.js` uses `a.startTime.getUTCHours()` to build `bookedHours` but compares against `startH`/`endH` parsed from local working hours string — UTC vs local timezone mismatch causes all slots to appear booked
    - Document counterexample: e.g. "clinic has 09:00-18:00 on Monday, date is a Monday with no appointments, but slots returns []"
    - _Requirements: 1.3, 1.4_

  - **Bug 3 — Dashboard 404 on Direct Navigation**
    - Scope: `isBugCondition_3(X)` where X.path = '/dashboard' and user is authenticated
    - Write a test that simulates direct navigation to `/dashboard` with a valid session and asserts the Dashboard component renders (not NotFound)
    - Run on UNFIXED code — expect 404/NotFound page (confirms bug)
    - Root cause to investigate: in `App.jsx`, the `!clinic` block handles specific public paths but the `publicPaths` array is defined but never used for routing — `/dashboard` with no session falls through to the authenticated layout with `clinic=null`, causing a crash or NotFound render
    - Document counterexample: e.g. "navigate to /dashboard in browser, session restores, but NotFound renders instead of Dashboard"
    - _Requirements: 1.5, 1.6_

  - **Bug 4 — Webhook Simulation Network Error**
    - Scope: `isBugCondition_4(X)` where X.url is a valid HTTPS URL submitted via the webhook test UI
    - Write a test that calls `POST /api/integrations/test-webhook` with a valid HTTPS URL and a valid auth token and asserts the response is NOT a network-level error (i.e. a JSON response is returned)
    - Run on UNFIXED code — expect "Network Error" (confirms bug)
    - Root cause to investigate: `ClinicSettings.jsx` uses raw `axios` (not the shared `api` instance from `lib/api.js`) — the raw axios instance does not include `withCredentials: true`, which may cause CORS preflight failure on the `/api/integrations/test-webhook` endpoint when credentials are required; alternatively the missing interceptor means expired tokens are not refreshed before the request
    - Document counterexample: e.g. "enter https://webhook.site/test, click Fire Webhook, frontend shows 'Network Error' with no HTTP status"
    - _Requirements: 1.7, 1.8_

  - Mark task complete when all four exploration tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Existing Correct Behaviors Must Not Regress
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code with non-buggy inputs, observe outputs, then encode as tests
  - **EXPECTED OUTCOME**: All preservation tests PASS on unfixed code (confirms baseline)

  - **Preservation — Bug 1: Validation still rejects bad input**
    - Observe: `POST /api/appointments` with missing `patientId` returns HTTP 400 on unfixed code
    - Write property test: for all requests missing any of `{ patientId, startTime, endTime }`, the response status is 400 and no appointment record is created
    - Verify passes on unfixed code
    - _Requirements: 3.1_

  - **Preservation — Bug 1: Audit log is written on valid creation**
    - Observe: a valid `POST /api/appointments` creates an audit record with action `CREATE_APPOINTMENT` and correct `clinicId`/`patientId`
    - Write test asserting audit log entry exists after successful creation
    - Verify passes on unfixed code
    - _Requirements: 3.2_

  - **Preservation — Bug 2: Fully-booked date returns empty slots**
    - Observe: `GET /api/public/clinic/:id/slots?date=...` returns `[]` when all hourly slots for that day are already booked
    - Write property test: for all dates where every working hour has a confirmed appointment, slots array is empty
    - Verify passes on unfixed code
    - _Requirements: 3.3_

  - **Preservation — Bug 2: Closed day returns empty slots**
    - Observe: slots endpoint returns `[]` for a date that falls on a day marked "Closed" in working hours
    - Write test for a Sunday/closed day returning empty array
    - Verify passes on unfixed code
    - _Requirements: 3.4_

  - **Preservation — Bug 2: Partially-booked date excludes booked hours**
    - Observe: when 2 of 9 working hours are booked, slots returns 7 entries excluding the booked hours
    - Write property test: for all dates with N booked slots out of M working hours, result length equals M - N
    - Verify passes on unfixed code
    - _Requirements: 3.5_

  - **Preservation — Bug 3: Genuine 404 still shows NotFound**
    - Observe: navigating to `/xyz` renders the NotFound page on unfixed code
    - Write test asserting unknown routes still render NotFound
    - Verify passes on unfixed code
    - _Requirements: 3.6_

  - **Preservation — Bug 3: Public booking route requires no auth**
    - Observe: `/book` renders PatientBooking without authentication on unfixed code
    - Write test asserting `/book` renders without a session
    - Verify passes on unfixed code
    - _Requirements: 3.7_

  - **Preservation — Bug 3: Login route renders for unauthenticated users**
    - Observe: `/login` and `/` render ClinicLogin when no session exists
    - Write test asserting these paths render ClinicLogin without a session
    - Verify passes on unfixed code
    - _Requirements: 3.8_

  - **Preservation — Bug 4: Invalid URL format is rejected without a request**
    - Observe: `POST /api/integrations/test-webhook` with a non-HTTP/HTTPS URL returns `{ success: false, error: 'Invalid Webhook URL format...' }` without making an outbound request
    - Write test asserting ftp:// and plain-text URLs are rejected with a validation error
    - Verify passes on unfixed code
    - _Requirements: 3.9_

  - **Preservation — Bug 4: Successful test logs audit action**
    - Observe: a successful webhook test creates a `TEST_WEBHOOK_CONNECTION` audit record with `success: true`, `latency`, and `url`
    - Write test asserting audit log entry exists after a successful test
    - Verify passes on unfixed code
    - _Requirements: 3.10_

  - Mark task complete when all preservation tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

- [x] 3. Fix Bug 1 — Appointment creation silently fails

  - [x] 3.1 Fix stale token closure in React Query appointment fetch
    - In `frontend/src/App.jsx`, the `queryFn` for the `appointments` query uses `getHeaders()` which closes over the `token` state variable — this creates a stale closure where the token captured at query definition time may be empty or outdated
    - Replace the inline `getHeaders()` call inside the `queryFn` with a ref-based token (`tokenRef.current`) so the latest token is always read at fetch time, OR move the query to use the shared `api` instance from `lib/api.js` which injects the token via interceptor
    - Ensure `refetchApts()` after `handleBook` triggers a fresh fetch with the current valid token
    - _Bug_Condition: isBugCondition_1(X) — valid appointment created but missing from subsequent GET /api/appointments_
    - _Expected_Behavior: listAppointments'(clinicId) result contains the newly created appointmentId_
    - _Preservation: validation errors still return 400; audit log still written on success_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Appointment Appears After Creation
    - **IMPORTANT**: Re-run the SAME test from task 1 (Bug 1 section) — do NOT write a new test
    - Run: POST /api/appointments → GET /api/appointments → assert new appointmentId is present
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Validation and Audit Behavior Unchanged
    - Re-run preservation tests from task 2 (Bug 1 sections)
    - **EXPECTED OUTCOME**: Tests PASS (no regressions in validation or audit logging)

- [x] 4. Fix Bug 2 — Public booking page shows no available time slots

  - [x] 4.1 Fix UTC vs local hour mismatch in getAvailableSlots
    - In `backend/services/publicService.js`, `getAvailableSlots` builds `bookedHours` using `a.startTime.getUTCHours()` but the working hours range (`startH` to `endH`) is in local clinic time
    - Fix: use `a.startTime.getHours()` (local time) instead of `getUTCHours()` so booked hour comparison is consistent with the working hours range, OR convert both to UTC consistently
    - The day boundary query already uses local time (`new Date(year, month-1, day, ...)`) so local hours is the correct reference frame
    - _Bug_Condition: isBugCondition_2(X) — clinic has working hours, date is a working day, slots returns []_
    - _Expected_Behavior: getAvailableSlots'(clinicId, dateStr).length > 0 for a working day with no bookings_
    - _Preservation: fully-booked dates still return []; closed days still return []; partial bookings still exclude booked hours_
    - _Requirements: 2.3, 2.4_

  - [x] 4.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Available Slots Returned for Working Day
    - Re-run the SAME test from task 1 (Bug 2 section)
    - **EXPECTED OUTCOME**: Test PASSES (slots array is non-empty for a working day with no bookings)
    - _Requirements: 2.3, 2.4_

  - [x] 4.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Slot Filtering Behavior Unchanged
    - Re-run preservation tests from task 2 (Bug 2 sections)
    - **EXPECTED OUTCOME**: Tests PASS (fully-booked, closed, and partial-booking cases unchanged)

- [x] 5. Fix Bug 3 — /dashboard returns 404 on direct navigation

  - [x] 5.1 Fix SPA routing to handle authenticated routes when session is restoring or absent
    - In `frontend/src/App.jsx`, the `!clinic` block handles specific public paths but falls through for authenticated paths like `/dashboard` — the `publicPaths` array is defined but never used
    - Fix: in the `!clinic` block, after handling known public paths, check if the current `path` is a known authenticated route (e.g. `/dashboard`, `/appointments`, `/patients`, `/reports`, `/settings`, `/ai`) — if so, redirect to `/login` (or render ClinicLogin) instead of falling through to the authenticated layout with `clinic=null`
    - The `authLoading` guard already handles the session-restoring case correctly — this fix only needs to handle the `!clinic && !authLoading` case for authenticated paths
    - _Bug_Condition: isBugCondition_3(X) — X.path = '/dashboard', user authenticated or session restoring, result is 404_
    - _Expected_Behavior: routeHandler'('/dashboard') renders Dashboard after session restore, or redirects to login if unauthenticated_
    - _Preservation: /xyz still shows NotFound; /book still renders PatientBooking; /login still renders ClinicLogin_
    - _Requirements: 2.5, 2.6_

  - [x] 5.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dashboard Renders on Direct Navigation
    - Re-run the SAME test from task 1 (Bug 3 section)
    - **EXPECTED OUTCOME**: Test PASSES (Dashboard renders or login redirect occurs — no 404)
    - _Requirements: 2.5, 2.6_

  - [x] 5.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Public and Unknown Routes Unchanged
    - Re-run preservation tests from task 2 (Bug 3 sections)
    - **EXPECTED OUTCOME**: Tests PASS (/xyz → NotFound, /book → PatientBooking, /login → ClinicLogin)

- [x] 6. Fix Bug 4 — AI Settings webhook simulation returns "Network Error"

  - [x] 6.1 Replace raw axios with shared api instance in ClinicSettings webhook test call
    - In `frontend/src/pages/ClinicSettings.jsx`, `handleTestWebhook` uses raw `axios.post(...)` with a manually constructed `Authorization` header — this bypasses the shared `api` instance in `lib/api.js` which includes `withCredentials: true` and the automatic token refresh interceptor
    - Fix: import the shared `api` instance from `lib/api.js` and replace the raw `axios.post` call in `handleTestWebhook` with `api.post(...)` — the interceptor will inject the current token and handle 401 refresh automatically, eliminating the CORS/credentials mismatch that produces "Network Error"
    - Verify the `timeout: 12000` option is preserved in the migrated call
    - _Bug_Condition: isBugCondition_4(X) — valid HTTPS URL submitted, POST /api/integrations/test-webhook returns network error_
    - _Expected_Behavior: testWebhook'(url) returns JSON with status or descriptive error message, never a raw "Network Error"_
    - _Preservation: invalid URL format still returns validation error; successful test still logs TEST_WEBHOOK_CONNECTION audit action_
    - _Requirements: 2.7, 2.8_

  - [x] 6.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Webhook Test Returns Structured Response
    - Re-run the SAME test from task 1 (Bug 4 section)
    - **EXPECTED OUTCOME**: Test PASSES (JSON response with status or descriptive error — no "Network Error")
    - _Requirements: 2.7, 2.8_

  - [x] 6.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Validation and Audit Behavior Unchanged
    - Re-run preservation tests from task 2 (Bug 4 sections)
    - **EXPECTED OUTCOME**: Tests PASS (invalid URLs rejected, audit log written on success)

- [x] 7. Checkpoint — Ensure all tests pass
  - Re-run the full test suite covering all four bug condition exploration tests and all preservation tests
  - All 4 exploration tests must PASS (bugs fixed)
  - All 10 preservation tests must PASS (no regressions)
  - Manually verify each fix in the running app: create an appointment and confirm it appears, select a date on the public booking page and confirm slots appear, navigate directly to /dashboard and confirm it loads, fire a webhook test and confirm a structured response is returned
  - Ask the user if any questions arise before marking complete
