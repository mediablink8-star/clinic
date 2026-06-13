# Bugfix Requirements Document

## Introduction

Four critical bugs have been identified in the ClinicFlows clinic management application that collectively render core functionality unusable. The issues span appointment creation silently failing in the admin panel, the public booking page showing no available time slots, the `/dashboard` route returning a 404 after login, and the AI Settings webhook simulation producing a network error. These bugs block the primary workflows of the application and must be resolved before launch.

---

## Bug Analysis

### Bug 1: Appointment Creation Failure (Admin Panel)

#### Current Behavior (Defect)

1.1 WHEN an authenticated admin creates a new appointment via the `NewAppointmentModal` for an existing patient THEN the system silently succeeds (no error shown) but the appointment does NOT appear in the "Ραντεβού" (Appointments) section on subsequent page load.

1.2 WHEN the appointments list is fetched via `GET /api/appointments` after a successful `POST /api/appointments` THEN the system returns an empty array or omits the newly created appointment, despite the backend returning a success response.

#### Expected Behavior (Correct)

2.1 WHEN an authenticated admin creates a new appointment via the `NewAppointmentModal` THEN the system SHALL persist the appointment to the database and immediately reflect it in the "Ραντεβού" section after the query is refetched.

2.2 WHEN `GET /api/appointments` is called after a successful `POST /api/appointments` THEN the system SHALL return the newly created appointment in the response array, scoped to the authenticated clinic's `clinicId`.

#### Unchanged Behavior (Regression Prevention)

3.1 WHEN an appointment creation request is missing required fields (`patientId`, `startTime`, or `endTime`) THEN the system SHALL CONTINUE TO return a 400 validation error without creating a record.

3.2 WHEN a valid appointment is created THEN the system SHALL CONTINUE TO log the `CREATE_APPOINTMENT` audit action and associate the appointment with the correct `clinicId` and `patientId`.

---

### Bug 2: Public Booking Page — No Available Time Slots

#### Current Behavior (Defect)

1.3 WHEN a patient accesses the public booking page (`/book?clinicId=...`) and selects a date THEN the system consistently displays "Κανένα διαθέσιμο ραντεβού" (No available appointments) in the time slot dropdown, even when the clinic has configured working hours and no appointments exist for that date.

1.4 WHEN `GET /api/public/clinic/:id/slots?date=YYYY-MM-DD` is called for a date that falls on a weekday within the clinic's configured working hours THEN the system returns an empty slots array.

#### Expected Behavior (Correct)

2.3 WHEN a patient selects a date that falls within the clinic's configured working hours and no appointments are booked for that date THEN the system SHALL return and display all available hourly time slots for that day.

2.4 WHEN `getAvailableSlots` resolves the day key from the `workingHours` JSON for a given date THEN the system SHALL correctly match the day name (e.g., `"Monday"`) against the stored working hours keys, regardless of key casing or format (`weekdays`, `monday`, `Monday`).

#### Unchanged Behavior (Regression Prevention)

3.3 WHEN a patient selects a date where all slots are already booked THEN the system SHALL CONTINUE TO return an empty slots array and display "Κανένα διαθέσιμο ραντεβού".

3.4 WHEN a patient selects a date that falls on a day marked as "Closed" in the clinic's working hours THEN the system SHALL CONTINUE TO return an empty slots array.

3.5 WHEN a patient selects a date and some slots are already booked THEN the system SHALL CONTINUE TO exclude booked hours and return only the remaining available slots.

---

### Bug 3: Dashboard 404 Error on Direct Navigation

#### Current Behavior (Defect)

1.5 WHEN an authenticated user navigates directly to `/dashboard` in the browser (e.g., by typing the URL or refreshing) THEN the system displays a 404 "Η σελίδα δεν βρέθηκε" error page instead of the dashboard.

1.6 WHEN the frontend SPA routing logic evaluates the `/dashboard` path for an unauthenticated or mid-auth-restore state THEN the system falls through to a 404 or unknown-route handler instead of waiting for session restoration or redirecting to login.

#### Expected Behavior (Correct)

2.5 WHEN an authenticated user navigates directly to `/dashboard` THEN the system SHALL render the Dashboard view after session restoration completes, without showing a 404 error.

2.6 WHEN the SPA routing logic encounters `/dashboard` and the user is not yet authenticated THEN the system SHALL redirect to the login page rather than rendering a 404 error.

#### Unchanged Behavior (Regression Prevention)

3.6 WHEN a user navigates to a genuinely non-existent route (e.g., `/xyz`) THEN the system SHALL CONTINUE TO display the 404 "Η σελίδα δεν βρέθηκε" page.

3.7 WHEN a user navigates to `/book` without authentication THEN the system SHALL CONTINUE TO render the public `PatientBooking` page without requiring login.

3.8 WHEN a user navigates to `/login` or `/` without an active session THEN the system SHALL CONTINUE TO render the `ClinicLogin` page.

---

### Bug 4: AI Settings — Webhook Simulation Network Error

#### Current Behavior (Defect)

1.7 WHEN a user enters a test URL in the AI Settings "Simulate Incoming Call" / "Fire Webhook" feature and submits THEN the system returns a "Network Error" with no further details, and the webhook test request does not reach the target URL.

1.8 WHEN the frontend calls `POST /api/integrations/test-webhook` with a valid HTTPS URL THEN the system fails with a network-level error before the backend can process the request.

#### Expected Behavior (Correct)

2.7 WHEN a user enters a valid HTTPS URL and fires the webhook simulation THEN the system SHALL send a signed POST request to the target URL and return the HTTP response status and latency to the user.

2.8 WHEN the target webhook URL is unreachable or returns an error status THEN the system SHALL return a descriptive error message (e.g., "Host not found", "Connection refused", or the HTTP status code) rather than a generic "Network Error".

#### Unchanged Behavior (Regression Prevention)

3.9 WHEN a user provides an invalid URL format (non-HTTP/HTTPS) for the webhook simulation THEN the system SHALL CONTINUE TO return a validation error without attempting the request.

3.10 WHEN the webhook simulation succeeds THEN the system SHALL CONTINUE TO log the `TEST_WEBHOOK_CONNECTION` audit action with the result, latency, and target URL.

---

## Bug Condition Summary

### Bug Condition Functions

```pascal
FUNCTION isBugCondition_1(X)
  INPUT: X = { patientId, startTime, endTime, clinicId } — valid appointment creation request
  OUTPUT: boolean
  RETURN X is submitted via NewAppointmentModal AND appointment does not appear in subsequent list fetch
END FUNCTION

FUNCTION isBugCondition_2(X)
  INPUT: X = { clinicId, dateStr } — public slot availability request
  OUTPUT: boolean
  RETURN clinic has working hours configured AND dateStr falls on a working day AND slots array is empty
END FUNCTION

FUNCTION isBugCondition_3(X)
  INPUT: X = { path } — browser navigation path
  OUTPUT: boolean
  RETURN X.path = '/dashboard' AND user is authenticated (or session is restoring)
END FUNCTION

FUNCTION isBugCondition_4(X)
  INPUT: X = { url } — webhook simulation request
  OUTPUT: boolean
  RETURN X.url is a valid HTTPS URL AND POST /api/integrations/test-webhook returns network error
END FUNCTION
```

### Fix Checking Properties

```pascal
// Property: Fix Checking — Bug 1
FOR ALL X WHERE isBugCondition_1(X) DO
  result ← listAppointments'(X.clinicId)
  ASSERT X.appointmentId IN result.data
END FOR

// Property: Fix Checking — Bug 2
FOR ALL X WHERE isBugCondition_2(X) DO
  result ← getAvailableSlots'(X.clinicId, X.dateStr)
  ASSERT result.length > 0
END FOR

// Property: Fix Checking — Bug 3
FOR ALL X WHERE isBugCondition_3(X) DO
  result ← routeHandler'(X.path)
  ASSERT result ≠ 404_PAGE
END FOR

// Property: Fix Checking — Bug 4
FOR ALL X WHERE isBugCondition_4(X) DO
  result ← testWebhook'(X.url)
  ASSERT result.error ≠ 'Network Error' AND result contains status or descriptive message
END FOR
```

### Preservation Checking

```pascal
// Property: Preservation Checking — all bugs
FOR ALL X WHERE NOT isBugCondition_N(X) DO
  ASSERT F(X) = F'(X)
END FOR
```
