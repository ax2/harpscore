# Stage 6 — import dialog interaction

2026-10-23, Asia/Shanghai.

The import window previously left focus behind the modal and did not contain keyboard navigation. It now focuses the JSON field, wraps Tab/Shift+Tab through enabled controls, closes on Escape when idle, and returns focus to the import action. The empty and selected toolbars reuse DOM nodes for different actions, so focus restoration finds the semantic import trigger instead of a stale button reference.

File reading reports its pending state and disables submission until complete. Typing, a newer selection, closing the window or starting a save invalidates an earlier read. A stale read therefore cannot overwrite a newer draft or a reopened window. Errors are associated with the field and announced as alerts. During saving, focus moves to the dialog, Tab stays there, and Escape/backdrop clicks cannot close it or move focus behind it.

Modal overlays now sit above the mobile sidebar, including during its transition. A short landscape viewport can scroll the dialog to reach its footer buttons.

Validation: production build and 112 tests pass. Chromium checks initial focus, both Tab boundaries, invalid JSON alerts, Escape/cancel, retained drafts, delayed file read races, a real shared-context storage lock, successful save, simulated quota failure, and focus return after the empty-to-selected toolbar change. Desktop 1440×1000, phone 390×844 and landscape 844×390 screenshots were inspected. The first test lock used separate browser contexts and did not actually block the save; it was corrected to use two pages in one context. The first phone capture overlapped the responsive sidebar transition; final captures wait for it to settle. No physical keyboard, screen-reader, device or other browser-engine acceptance is claimed.
