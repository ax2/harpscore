# Stage 6 — legacy melody audit and import boundaries

2026-10-23, Asia/Shanghai.

Old metadata and passing rhythm checks concealed incorrect octaves, missing ties and omitted repeats. This pass freshly compares eleven legacy songs with complete readable sources and checks the two original exercises. The remaining legacy song, Spanish Rowing Song, still needs a readable source for its second half. See the [per-score audit](../sources/stage-6-legacy-audit.md).

- Amazing Grace: restore source pickup, two high-sol notes, two-beat ending and G4–G5 register.
- Ode to Joy: restore low sol, cross-bar same-pitch tie and second-section repeat.
- Happy Birthday: expand both endings; remove artificial opening rests. Auld Lang Syne also keeps its actual pickup instead of padded rests.
- Mary, Frere Jacques, Silent Night and Sally Gardens: adopt explicitly identified, readable ABC versions. Version differences are documented, including the 6/8 Silent Night and 17-bar Sally Gardens; no mixture of incompatible arrangements is claimed.
- Twinkle, Jingle Bells and Farewell: fresh complete numbered-source comparisons. Melody/rhythm unchanged; improve source attribution and distinguish the Jingle Bells chorus from a full song. Farewell's original tonic is Eb, not E.
- Two original exercises: check their declared bar counts and bend targets, distinguish written straight eighths from an optional shuffle interpretation.
- Imports reject inherited property names as keys. Truncation and duplicate suffixes preserve Unicode code points and stable canonical IDs across JSON export/reimport and storage reload. Minimum corpus checks now require 40 songs and four original exercises.

Validation: 112 tests, 44 score checks and production build; independent ABC decoding matches 188 events across the four adopted sources. Thirteen actual A4 PDFs preserve every rendered row and tie. Four desktop (1440×1000) and mobile (390×844) views captured, with representative views and PDF pages inspected. Browser import tests reject `__proto__`, save colliding supplementary-plane Unicode IDs, then reload without changing their identities. No browser page errors.

The first mobile capture occurred during the sidebar's responsive transition and was discarded as acceptance evidence; the script now waits for the sidebar to be fully off-screen and the compact SVG layout to settle. Source tables and selected regression landmarks are not an independent professional performance review. Spanish Rowing Song's second half, other browser engines and real instruments/devices remain outside this pass's verification.
