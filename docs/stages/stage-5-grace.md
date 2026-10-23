# Stage 5: grace notes and blues exercises — 2026-10-22

The library grows from 25 to 28 entries: 24 songs and four original exercises. Longing for Spring now retains the PEP edition's small G before F in the penultimate bar. The new call-response and low blues-scale studies are explicitly original exercises, not additions to the target of at least 40 distinct songs.

The importer accepts one to four pre-grace notes in JSON or `{5}4` / `{6;1'}2` DSL. Small eighth/sixteenth shapes carry pitch/register but do not add independent measure beats. Nested graces, rests, lyrics, ties and additional techniques on graces are rejected. Octave shifting is baked into both principal and grace notes. A tie crossing an intervening grace group is flagged as unsupported.

SVG and PNG exports show small raised digits, octave dots, accidentals, beams, connecting curves and fingering. Grace pitches are included in range, bend counts and playability; natural-note filtering cannot hide a difficult grace. Accidentals on graces participate in subsequent cancellation signs. JSON exports preserve the structure.

Validation: 49 tests pass; 28 built-ins pass source/rhythm/tie/playability gates; production build passes. Chromium opens every exact title without notation warnings or console/page errors. Desktop 1440×1100 checks analysis and SVG/JSON/PNG downloads; mobile 390×844 checks reflow and the grace note in context. Full 1080px Mozart/blues SVGs and 420px mobile Mozart sheet were rendered for inspection. The first mobile capture caught sidebar animation and was replaced after waiting for the sidebar to finish closing.

Source review covers Mozart's two complete textbook pages, chromatic bridge, pickup/rest complement, ties and grace. The two original exercises have targeted checks for natural reeds/breathing rests and the G blues pitch set with Bb4/Db5 half-step draw bends. An initial test incorrectly expected a rest or long note in every call-response bar; the intended musical requirement is rest at each four-bar phrase ending, and the assertion was corrected accordingly.

Limits: no grace playback/timing allocation, trill/mordent realization or second-reader/physical-instrument acceptance is claimed. Wuxi Jing remains pending: the first-bar wavy ornament needs identification and auxiliary-pitch verification. Code and evidence are local; this batch does not constitute a release. The wider expansion goal remains active.
