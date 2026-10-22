# Stage 5 batch 3 — 2026-10-22

Library grows from 20 to 25 entries: 23 songs and 2 original exercises. Added Yankee Doodle (verse + chorus), My Bonnie (full 32-bar form plus pickup), Fengyang Flower Drum (15-bar PEP edition), Click Go the Shears (16 bars) and Santa Lucia (repeat and alternate endings retained/expanded).

Sources and adaptations are recorded in the transcription ledger. An independent one-off ABC decoder compared all note/rest events for Yankee Doodle (61) and My Bonnie (67) against generated JSON, including pitch register and duration. It does not reuse the application's import/notation code. My Bonnie's draft register was corrected before the final match; source traceability is not a substitute for checking octaves.

Santa Lucia exposed a printed-notation bug: a natural note following a sharp of the same degree/octave in one bar had the correct calculated pitch but no cancellation sign. The SVG renderer now prints the natural sign. Alterations remain explicit per note in data/DSL; state resets at each bar. Tests cover sharp/flat cancellation, octave separation and bar resets.

Validation: 41 tests pass; all 25 scores pass rhythm, tie, source and playability gates; production build passes. Chromium opens every exact title with no notation warnings or browser errors. Desktop 1440×1100 verifies the Chinese-folk filter and SVG download with natural sign; mobile 390×844 verifies search/select/reflow. The full 1080px Santa Lucia SVG was rendered separately for uncropped visual inspection.

No human second-reader, physical-instrument or real-device sign-off is claimed. Grace-note and free-rhythm candidates remain pending. Work is locally committed and archived; no release or remote push in this batch. The broader expansion goal remains active.
