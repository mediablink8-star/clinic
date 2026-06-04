# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - TDZ Error on Module Evaluation
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the TDZ error exists in production builds or specific execution contexts
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - production build evaluation, HMR scenarios, or direct component imports
  - Test that QuickActions module can be evaluated and all three components (QuickActionBtn, TestSetupModal, QuickActions) are initialized without ReferenceError
  - Test implementation details from Bug Condition in design: `input.componentDefinitionStyle === 'const_arrow_function' AND input.componentUsesOtherComponents === true AND input.executionContext IN ['build', 'hmr', 'production_bundle']`
  - The test assertions should verify: no TDZ errors occur, all components are defined and accessible, QuickActions can be rendered
  - Run test on UNFIXED code (const arrow functions)
  - **EXPECTED OUTCOME**: Test FAILS with "Cannot access 'Q' before initialization" or similar ReferenceError (this is correct - it proves the bug exists)
  - Document counterexamples found: specific execution contexts (production build, HMR, etc.) where the TDZ error occurs
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Component Functionality and Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for all user interactions and rendering scenarios (after successful initialization in contexts where the bug doesn't occur)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - All quick action buttons render with correct labels and icons (Νέο Ραντεβού, Ασθενείς, SMS, Κλήση, Δοκιμή Ρύθμισης)
    - Button clicks trigger correct callbacks and open correct modals (SendMessageModal, CallPatientModal, TestSetupModal)
    - QuickActionBtn component applies correct styling for different variants (primary, secondary, ai)
    - TestSetupModal executes test trigger API call and displays results correctly
    - All props are handled correctly (onViewSchedule, onAddPatient, onNewAppointment, patients, token, clinic, onRefresh)
  - Property-based testing generates many test cases for stronger guarantees (random prop combinations, interaction sequences, edge cases)
  - Run tests on UNFIXED code in contexts where initialization succeeds (e.g., development mode)
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for Temporal Dead Zone initialization error

  - [x] 3.1 Convert QuickActionBtn to function declaration
    - Change line 10 from `const QuickActionBtn = ({ icon: Icon, label, onClick, variant = 'outline', badge }) => {` to `function QuickActionBtn({ icon: Icon, label, onClick, variant = 'outline', badge }) {`
    - Remove closing `};` and replace with `}`
    - Verify function hoisting makes QuickActionBtn available throughout module scope
    - _Bug_Condition: isBugCondition(input) where input.componentDefinitionStyle === 'const_arrow_function' AND componentAccessedBeforeInitialization(input)_
    - _Expected_Behavior: Component is hoisted and available before QuickActions references it, eliminating TDZ error_
    - _Preservation: All button rendering, styling, props handling, and click handlers remain identical_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [x] 3.2 Convert TestSetupModal to function declaration
    - Change line 40 from `const TestSetupModal = ({ token, clinic, onClose }) => {` to `function TestSetupModal({ token, clinic, onClose }) {`
    - Remove closing `};` and replace with `}`
    - Verify function hoisting makes TestSetupModal available throughout module scope
    - _Bug_Condition: isBugCondition(input) where input.componentDefinitionStyle === 'const_arrow_function' AND componentAccessedBeforeInitialization(input)_
    - _Expected_Behavior: Component is hoisted and available before QuickActions references it, eliminating TDZ error_
    - _Preservation: All modal functionality, API calls, state management, and UI remain identical_
    - _Requirements: 2.1, 2.2, 2.3, 3.4_

  - [x] 3.3 Convert QuickActions to function declaration
    - Change line 125 from `const QuickActions = ({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], token, clinic, onRefresh }) => {` to `function QuickActions({ onViewSchedule, onAddPatient, onNewAppointment, patients = [], token, clinic, onRefresh }) {`
    - Remove closing `};` and replace with `}`
    - Verify function hoisting makes QuickActions available throughout module scope
    - Verify export statement remains: `export default QuickActions;`
    - _Bug_Condition: isBugCondition(input) where input.componentDefinitionStyle === 'const_arrow_function' AND componentAccessedBeforeInitialization(input)_
    - _Expected_Behavior: Component is hoisted and available, can reference QuickActionBtn and TestSetupModal without TDZ errors_
    - _Preservation: All component orchestration, state management, modal rendering, and props handling remain identical_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Module Initialization Without TDZ Errors
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no TDZ errors, all components initialized)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1 in all execution contexts (production build, HMR, direct import)
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - no more "Cannot access 'Q' before initialization" errors)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Component Functionality and Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - all functionality preserved)
    - Confirm all tests still pass after fix: button rendering, click handlers, modal interactions, styling, props handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Verify bug condition test passes (no TDZ errors in any execution context)
  - Verify preservation tests pass (all functionality preserved)
  - Test production build: build application and verify Dashboard loads without errors
  - Test development server: verify Dashboard renders correctly
  - Test HMR: make changes and verify hot module replacement works without errors
  - Ensure all tests pass, ask the user if questions arise
