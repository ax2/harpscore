# Stage 6 — Firefox and storage visibility

2026-10-23, Asia/Shanghai.

Firefox 153.0 was added to local headless verification. Its initial localhost request failed under the default proxy configuration; an isolated test launch with `network.proxy.type=0` reaches the existing local development server. No user browser profile or system proxy setting was changed.

The Firefox favorites test twice reproduced a lost update: two tabs queued different additions under the same Web Lock, but only the second item remained in all three pages. Chromium passed that scenario. Keeping the lock until a subsequent task after writing fixed this reproduction. Storage writes now use one shared helper that also starts the mutation in a new task after acquiring the lock. Both favorites and personal scores use it, so reads and writes do not rely on a localStorage snapshot surviving the current task boundary. The existing personal-library Firefox scenario passed before the helper change; this pass does not claim it independently reproduced the same loss there.

The snapshot explanation is an inference consistent with the reproduction and [Mozilla's discussion of task-scoped storage values](https://bugzilla.mozilla.org/show_bug.cgi?id=1378716). The [HTML storage specification](https://html.spec.whatwg.org/multipage/webstorage.html) warns that localStorage alone does not provide locking. This helper is a tested compatibility measure, not a claim of transactional guarantees across arbitrary browser versions, suspended processes or browsers without Web Locks.

Validation on the final helper:

- Node 26.10.0 and an explicit Node 24.22.1 executable each pass 117 tests. Production build succeeds.
- Chromium 151.0.7922.34 and Firefox 153.0 each run four tabs through 20 concurrent rounds. Each finishes with all 80 favorites and 80 personal scores, including 80 unique IDs despite simultaneous same-ID imports.
- Firefox import, restore, personal-library corruption/stale deletion, favorites/resize and technique/export suites pass with no page errors. All 44 builtin scores open with their expected pitch-analysis status; SVG, PNG and JSON exports retain technique information. Print DOM annotations are checked, but Firefox's native PDF pagination is not verified.
- Firefox 390×844 import and 420-wide technique screenshots inspected. Desktop/mobile evidence is retained with the browser scripts and results.

Remote evidence is tracked separately in [the CI note](stage-6-ci.md); successful older revisions do not certify this newer helper.


Final checkpoint at 01:54: a regression now verifies that a queued publication happens before lock release on both success and error. The helper keeps its post-write task checkpoint in `finally`, because a restore may have written its recovery copy before a later write fails. Node 24/26 pass all 117 tests; production asset is index-Dm19vT0d.js.

A repeated stress run made alongside the build reported 51 favorites instead of 52 in Chromium at round 12. That browser context was not retained, so delayed observation versus persistent loss cannot be determined from that run. The stress script now records immediate counts and waits up to three seconds for both data sets to become visible before checking IDs. A subsequent 20-round run passed; a 100-round run then passed on each browser, with 400 favorites and 400 personal scores/unique IDs per browser and no immediate-count discrepancies recorded. These later successes do not erase the isolated failure. Reproduction under simultaneous load remains a follow-up; do not describe this as a universal storage-atomicity guarantee.
