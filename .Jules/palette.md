## 2025-05-15 - [Keyboard Accessibility in Custom Components]
**Learning:** Many custom UI components (like Tooltips and pipeline overview cards) were missing keyboard focus support, which is a critical accessibility gap for keyboard-only users. Semantic buttons and explicit focus handlers are essential for custom-built UI systems.
**Action:** Always check if `onClick` is used on non-interactive elements like `div` and convert them to `button`. Ensure Tooltips trigger on `onFocus` and `onBlur` to support keyboard navigation.
