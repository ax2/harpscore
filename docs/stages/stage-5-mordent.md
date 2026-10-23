# Stage 5: single mordents and two Chinese melodies — 2026-10-22

The library grows to 30 entries (26 songs, four original exercises) with Wuxi Jing and Li Shutong's Spring Excursion. Both retain the complete selected 16-bar main melodies. The source ledger records edition, page, register, ornament and omitted accompaniment/expression details.

Wuxi Jing's first-bar ornament was identified as a single upper mordent by comparing the source's short wave with the notation/playback examples in Basic Music Theory Course, p.183. The implementation stores an explicit neighboring pitch instead of treating the symbol as a cosmetic trill. DSL `[U:3']2'/` and `[L:1]2` represent upper/lower mordents. JSON `ornament` contains `kind` and `auxiliary`; the auxiliary has no independent duration. Direction, adjacent scale degree, octave limits and unsupported nested decoration are checked.

Auxiliary pitches participate in fingering/range/bend analysis and library filters. Each is counted once and labelled separately in the UI. The SVG draws the wave (with a vertical stroke for lower mordents), explicit auxiliary alterations/cancellations and a small auxiliary fingering row. Extra space separates it from lyrics. Unsupported auxiliary pitches show `辅 ?` and a located analysis error. Ties crossing into a mordent are flagged.

Validation: 56 tests pass, all 30 built-ins pass the source/rhythm/tie/playability gate, production build passes. Chromium opens all exact titles; no notation warnings, page errors or console errors. SVG/JSON/PNG exports preserve the Wuxi ornament and both graces. An imported F#5 auxiliary is correctly rejected for the normal C-harp mode and has no stale fingering. Desktop 1440×1100, mobile 390×844 and complete 1080px/420px score images inspected. Spring Excursion's complete exported SVG was compared to the two source pages.

No audio playback, exact ornament timing, compound mordents, turns or trill realization is added. No physical-instrument, real-device or independent human second-reader sign-off is claimed. Work and evidence remain local, not a release; the wider expansion goal continues.
