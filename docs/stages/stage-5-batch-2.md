# Stage 5 batch 2 — 2026-10-22

Added four source-checked melodies: Xiao Bai Cai, London Bridge, Oh Susanna and Zou Jiang Zhou. Library grows from 16 to 20 entries (18 songs, 2 original exercises). This remains a partial batch toward the 40-song expansion goal.

Xiao Bai Cai requires 5/4 followed by 4/4. Measure-level `timeSignature` now imports, persists and renders with reserved horizontal space. DSL syntax is `[M:4/4]` at a measure start; later measures inherit it. Invalid meters and misplaced tokens are rejected. Pickup suppression is conservative for pieces with meter changes. JSON/SVG export preserves the change.

ABC/LilyPond source text now has the explicit `music-text` source format and a reader-facing label. This is source metadata, not a general-purpose ABC importer. Source edition, transposition and repeat handling are recorded in each score and the transcription ledger.

Validation: 33 tests pass, all 20 scores pass the rhythm/source/playability gate, production build succeeds. Chromium at 1440×1100 opened every entry with no notation warnings or browser errors; 390×844 mobile search/reflow and full 420px sheet checked visually. Xiao Bai Cai JSON and SVG downloads preserve its 4/4 change. Screenshots retained in the project archive and task outputs.

Limits: no physical harmonica performance, real mobile-device test, or human second-reader sign-off; phrase slurs, grace notes and triplets are not yet supported. Unverified candidates remain outside the built-in library. No release/push in this batch.
