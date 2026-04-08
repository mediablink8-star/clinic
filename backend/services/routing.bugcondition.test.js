/**
 * Bug Condition Exploration Test — Bug 3: Dashboard 404 on Direct Navigation
 *
 * Root cause: in frontend/src/App.jsx, `publicPaths` array is defined but never used.
 * When a user navigates to `/dashboard` with clinic=null (mid-auth-restore or unauthenticated),
 * the routing logic falls through to render the authenticated layout with clinic=null,
 * causing a broken render instead of redirecting to login or showing NotFound.
 *
 * The bug in App.jsx (inside the `if (!clinic)` block):
 *
 *   if (!clinic) {
 *     if (path === '/register') return <ClinicRegister ... />;
 *     if (path === '/reset-password') return <ResetPassword />;
 *     if (path === '/' || path === '/login') return <ClinicLogin ... />;
 *
 *     // publicPaths is defined but NEVER USED to guard the fallthrough:
 *     const publicPaths = ['/', '/login', '/register', '/reset-password', '/book',
 *                          '/dashboard', '/appointments', '/patients', '/reports',
 *                          '/settings', '/ai'];
 *     // Falls through to render the full authenticated layout with clinic=null
 *     // This causes Dashboard to receive clinic=null → broken render / 404 behavior
 *   }
 *
 * The fix: use publicPaths to redirect known app routes to login:
 *   if (publicPaths.includes(path)) return <ClinicLogin ... />;
 *   return <NotFound />;
 *
 * Validates: Bug Condition 3 (isBugCondition_3)
 */

/**
 * Extracts the routing decision logic from App.jsx for pure unit testing.
 * This mirrors the exact logic in the component without requiring React.
 */

// BUGGY routing logic (as-is in App.jsx)
function routeDecision_buggy(path, clinic, authLoading) {
  // Public Patient Booking View
  if (path === '/book') return 'PatientBooking';

  // Session Restoration Guard
  if (authLoading) return 'SplashScreen';

  if (!clinic) {
    if (path === '/register') return 'ClinicRegister';
    if (path === '/reset-password') return 'ResetPassword';
    if (path === '/' || path === '/login') return 'ClinicLogin';

    // publicPaths is defined but NEVER USED — this is the bug
    // eslint-disable-next-line no-unused-vars
    const publicPaths = ['/', '/login', '/register', '/reset-password', '/book',
                         '/dashboard', '/appointments', '/patients', '/reports',
                         '/settings', '/ai'];

    // Falls through to render the authenticated layout with clinic=null
    // In the real component, this renders the full layout with null clinic
    // which causes Dashboard to receive clinic=null → broken render
    return 'AuthenticatedLayout_with_null_clinic'; // represents the bug
  }

  // Authenticated layout
  return 'AuthenticatedLayout';
}

// FIXED routing logic
function routeDecision_fixed(path, clinic, authLoading) {
  if (path === '/book') return 'PatientBooking';
  if (authLoading) return 'SplashScreen';

  if (!clinic) {
    if (path === '/register') return 'ClinicRegister';
    if (path === '/reset-password') return 'ResetPassword';
    if (path === '/' || path === '/login') return 'ClinicLogin';

    const publicPaths = ['/', '/login', '/register', '/reset-password', '/book',
                         '/dashboard', '/appointments', '/patients', '/reports',
                         '/settings', '/ai'];

    // FIXED: use publicPaths to redirect to login for known app routes
    if (publicPaths.includes(path)) return 'ClinicLogin';
    return 'NotFound'; // truly unknown route
  }

  return 'AuthenticatedLayout';
}

describe('Bug 3: Dashboard 404 on Direct Navigation', () => {
  /**
   * BUG CONDITION: /dashboard with null clinic (mid-auth-restore or unauthenticated)
   * Expected on UNFIXED code: renders broken authenticated layout with clinic=null
   * Expected on FIXED code: redirects to ClinicLogin
   *
   * This assertion FAILS on unfixed code — confirms the bug exists.
   */
  test('BUG3: /dashboard with null clinic should redirect to login, not render broken layout', () => {
    const result = routeDecision_buggy('/dashboard', null, false);

    // BUG CONDITION: This FAILS on unfixed code
    // Actual: 'AuthenticatedLayout_with_null_clinic' (broken render)
    // Expected: 'ClinicLogin' (redirect to login)
    expect(result).toBe('ClinicLogin');
  });

  test('BUG3: /appointments with null clinic should redirect to login, not render broken layout', () => {
    const result = routeDecision_buggy('/appointments', null, false);
    expect(result).toBe('ClinicLogin');
  });

  test('BUG3: /patients with null clinic should redirect to login, not render broken layout', () => {
    const result = routeDecision_buggy('/patients', null, false);
    expect(result).toBe('ClinicLogin');
  });

  test('BUG3: /settings with null clinic should redirect to login, not render broken layout', () => {
    const result = routeDecision_buggy('/settings', null, false);
    expect(result).toBe('ClinicLogin');
  });

  test('BUG3: truly unknown route /xyz with null clinic should show NotFound', () => {
    const result = routeDecision_buggy('/xyz', null, false);
    // This also falls through to broken layout — should be NotFound
    expect(result).toBe('NotFound');
  });

  // ─── Regression tests (should pass on both buggy and fixed code) ───────────

  test('REGRESSION: /book renders PatientBooking without auth', () => {
    expect(routeDecision_buggy('/book', null, false)).toBe('PatientBooking');
    expect(routeDecision_fixed('/book', null, false)).toBe('PatientBooking');
  });

  test('REGRESSION: /login renders ClinicLogin without auth', () => {
    expect(routeDecision_buggy('/login', null, false)).toBe('ClinicLogin');
    expect(routeDecision_fixed('/login', null, false)).toBe('ClinicLogin');
  });

  test('REGRESSION: / renders ClinicLogin without auth', () => {
    expect(routeDecision_buggy('/', null, false)).toBe('ClinicLogin');
    expect(routeDecision_fixed('/', null, false)).toBe('ClinicLogin');
  });

  test('REGRESSION: authLoading shows SplashScreen', () => {
    expect(routeDecision_buggy('/dashboard', null, true)).toBe('SplashScreen');
    expect(routeDecision_fixed('/dashboard', null, true)).toBe('SplashScreen');
  });

  // ─── Fixed code verification ────────────────────────────────────────────────

  test('FIXED: /dashboard with null clinic redirects to login', () => {
    const result = routeDecision_fixed('/dashboard', null, false);
    expect(result).toBe('ClinicLogin');
  });

  test('FIXED: /dashboard with authenticated clinic renders dashboard', () => {
    const clinic = { id: 'clinic-1', name: 'Test Clinic' };
    const result = routeDecision_fixed('/dashboard', clinic, false);
    expect(result).toBe('AuthenticatedLayout');
  });

  test('FIXED: /xyz still shows NotFound on fixed code', () => {
    expect(routeDecision_fixed('/xyz', null, false)).toBe('NotFound');
  });
});

/*
 * FAILURE OUTPUT (expected on unfixed code):
 *
 * FAIL backend/services/routing.bugcondition.test.js
 *   Bug 3: Dashboard 404 on Direct Navigation
 *     ✕ BUG3: /dashboard with null clinic should redirect to login, not render broken layout
 *       expect(received).toBe(expected)
 *       Expected: "ClinicLogin"
 *       Received: "AuthenticatedLayout_with_null_clinic"
 *
 *     ✕ BUG3: /appointments with null clinic should redirect to login, not render broken layout
 *       Expected: "ClinicLogin"
 *       Received: "AuthenticatedLayout_with_null_clinic"
 *
 *     ✕ BUG3: /patients with null clinic should redirect to login, not render broken layout
 *       Expected: "ClinicLogin"
 *       Received: "AuthenticatedLayout_with_null_clinic"
 *
 *     ✕ BUG3: /settings with null clinic should redirect to login, not render broken layout
 *       Expected: "ClinicLogin"
 *       Received: "AuthenticatedLayout_with_null_clinic"
 *
 *     ✕ BUG3: truly unknown route /xyz with null clinic should show NotFound
 *       Expected: "NotFound"
 *       Received: "AuthenticatedLayout_with_null_clinic"
 *
 * This confirms the bug: publicPaths is defined but never used to guard the fallthrough.
 * The fix: add `if (publicPaths.includes(path)) return <ClinicLogin />;`
 *          and `return <NotFound />;` after the publicPaths definition.
 */
