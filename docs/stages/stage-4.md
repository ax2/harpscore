# Stage 4 — notation correctness and validation

Date: 2026-10-22 (Asia/Shanghai). Baseline: 9078226.

## User-visible changes

- Sustained notes display duration dashes; long rests display repeated zeroes. Multiple octave dots and ties crossing line breaks are retained.
- Dense rows wrap within the page; mobile notation reflows into readable short rows instead of shrinking the entire desktop sheet.
- Standard Richter keys G–B use their normal third-octave roots; C–F# use fourth-octave roots. C-harp 10 blow B6 is one semitone bent, Bb6 two. Blow bends are labeled as blowing. The engine also covers standard overdraw pitches when its advanced mode is explicitly enabled; the current UI remains in normal/bend mode.
- Imports reject zero meter, impossible dates, unrenderable note lengths, invalid octave ranges and malformed source formats. Invalid ties and beat mismatches are visible beside the score. A single incomplete measure no longer qualifies as a complementary pickup pair.
- Failed local storage writes retain the import dialog and JSON. Export errors are visible. Printed titles are assigned as text instead of interpolated into HTML.
- Score generation checks rhythm, ties, provenance fields and duplicate IDs before writing. A regression check compares all generated scores with their source DSL.

## Evidence

- `npm test`: 24/24 passed.
- `npm run scores:build` and `npm run scores:validate`: 14/14 passed; source melodies unchanged.
- `npm run build` and `git diff --check`: passed.
- Chromium interaction checks at 1440×1000 and 390×844, dark UI: search/select, import, invalid meter, quota failure, SVG content, PNG dimensions (2160 px wide), cross-row ties, multiple octaves and print-title injection passed. No page errors or console warnings/errors.
- Browser plugin was not available; regular Playwright used through the locally installed runtime. UI screenshots were inspected. Mobile screenshot capture waits for the drawer transition to finish.

## References and limits

- [HOHNER Standard Richter tables](https://www.hohner-cshop.de/out/media/HOHNER%20DATASHEET%20for%2010-hole%20Standard%20Richter.pdf), accessed 2026-10-22.
- [Steve Baker: Bending & Overblowing](https://my.hohner.de/t/harmonica-terminology-3-bending-overblowing/1377), accessed 2026-10-22.
- Source URLs/dates are provenance metadata, not proof of melody correctness. This stage did not freshly transcribe or independently recheck every historical melody.
- Standard Richter only; Low/High and alternate tunings are not modeled. Triplets remain unsupported. Physical printer pagination, real-device Safari/Firefox and listening/human performance verification remain outside this stage's evidence.
- Local stage completion; no remote release or ZIP created. Long-term archive: `C:\Users\ax2\Documents\技术博客\harpscore`.

## Next

Stage 5: expand the traceable library to at least 40 distinct scores, balancing Chinese familiar/introductory material with blues exercises and Western traditional tunes as requested on 2026-10-22. Original exercises and transposed copies are counted separately. Continue until the daily 02:00 Beijing pause boundary, then save handoff and pause the goal without automatic resumption.
