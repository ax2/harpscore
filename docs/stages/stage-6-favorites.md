# Stage 6 — favorites across tabs

2026-10-23, Asia/Shanghai.

Favorites previously saved a whole list from the page's stale state, overwriting another tab's additions. Each click now applies an explicit add/remove choice to freshly read storage inside a Web Lock. Repeating the same choice is idempotent. Tabs refresh favorites on storage changes, and manual library reload refreshes them too. Malformed/unreadable data blocks writing; quota failures leave the stored list and displayed pressed state intact. A pending write disables the favorite button. Browsers without Web Locks use a synchronous fallback without a simultaneous cross-tab guarantee.

A related responsive check found that resizing an open mobile drawer to desktop left the page covered by its backdrop. The backdrop is now displayed only at the mobile breakpoint; desktop controls remain usable.

Validation: 116 tests and production build pass. Four new tests cover stale state, idempotence, corrupt/unreadable data, quota failure and reading after lock acquisition. Chromium uses three pages in one browser context to hold a real lock and queue two user clicks. Both different additions survive; duplicate removals remain removed; both filtered lists update, and storage failure and manual refresh behave correctly. Desktop 1440×1000 and mobile 390×844 screenshots inspected. The first responsive script attempted a desktop click with the stale drawer backdrop still present; the behavior was reproduced and fixed before rerunning successfully.

During Node 26 testing, synchronous throwing lock callbacks stalled the malformed-data test. Returning an async callback, as the personal-library store already does, makes rejection explicit; all 116 tests then finish. No unrelated process or test failure was hidden.
