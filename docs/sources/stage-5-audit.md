# Stage 5 transcription ledger

All dates use Asia/Shanghai. Only melodic note/rhythm data are incorporated. Source page artwork, lyrics and accompaniments are excluded. A source-check date denotes an actual comparison with the specified version, not a universal claim across folk variants.

| ID | Primary source and location | Comparison and adaptation |
| --- | --- | --- |
| arirang | School-hosted Guangdong Education/Huacheng grade 3 music textbook, printed p.53 / PDF p.54 | Visually inspected complete numbered notation on 2026-10-22. 16 bars of 3/4; dotted quarter + three eighths in opening. First eight bars and second eight bars have different endings. F tonic transposed to C; source octaves then raised one octave. Low la uses draw bend. Slurs/lyrics omitted explicitly. |
| harvest-song | Same textbook, printed pp.50–51 / PDF pp.51–52 | Both pages visually inspected on 2026-10-22. 24 bars of 2/4, including the continuation after p.50. Repeated section and upper-register middle section retained; three phrase-ending quarter rests. Bb tonic transposed to C, then up one octave. |
| xiao-bai-cai | Guo Liping / Wang Limin / Ma Zhifei, Music Appreciation, Xinhua Publishing, printed p.17 / PDF p.24, example 1-7 | Visually inspected 2026-10-22. Four 5/4 main-verse bars and two 4/4 coda bars, repeat markers retained. This edition uses do–low la in bar 4; another theory textbook uses low ti–low la, so variants must not be mixed. Ab to C, up one octave. Different-pitch slurs and lyrics omitted. |
| zou-jiang-zhou | Same Music Appreciation, printed p.6 / PDF p.13, example 1-1 | Complete 23 bars visually read 2026-10-22, with enlarged inspection of first two rows. Bar 2 is eighth + two sixteenths + quarter; bar 3 jumps to upper do, not middle do. Bars 6–7 have alternating sixteenth notes/rests. G to C, up one octave. Only main notated rhythm retained; tiny alternative syllable rhythms for later verses and slurs omitted. |
| london-bridge | The Everyday Song Book (1927), No.18; John Chambers ABC transcription (2015) | Direct ABC file read 2026-10-22. Top melody of two-voice chords, 8 bars in common time; dotted quarter opening, tied quarters, final quarter rest. F to C, up one octave. No lower voice/lyrics incorporated. |
| oh-susanna | Frank Nordberg / musicaviva ABC transcription, John Chambers mirror | Direct ABC file read 2026-10-22. Half-beat pickup, two passes through the eight-bar verse, eight-bar chorus. First verse ending merges with next pickup; second ending includes eighth rest. Final dotted quarter complements pickup. Source C5 register preserved; chords omitted. 25 written bars including pickup. |
| yankee-doodle | The Everyday Song Book (1927), No.3; John Chambers ABC (2015) | Direct ABC read 2026-10-22. Complete verse and lower-register chorus, eighth pickup and dotted rhythms. A4 tonic becomes C5. Independent ABC event decoding matches all 61 note/rest events against generated score pitches and durations. |
| my-bonnie | Same song book, No.6 | Direct ABC read 2026-10-22; source note documents repaired flag in bar 5. Complete 32-bar verse/chorus plus pickup; middle two-beat ending joined to the next phrase pickup. Bb4 tonic becomes C5. Draft main-verse octave error corrected during source review; independent ABC decoding then matches all 67 note/rest events. Fermata omitted explicitly; written durations retained. |
| fengyang-flower-drum | PEP Music, Grade 7 lower, numbered notation, printed p.31 / PDF p.36 | Full 15 bars visually inspected 2026-10-22. Main-melody low la marks agree with Guangdong/Huacheng grade 3 book, resolving the earlier candidate concern without guessing a different register. C key, up one octave. Two eighth rests in rhythmic coda retained. Lyrics/accompaniment/slurs omitted. |
| click-go-the-shears | Same PEP book, printed p.46 / PDF p.51 | 16-bar displayed melody visually inspected 2026-10-22. Dotted eighth/sixteenth rhythms, four quarter rests and the last phrase's middle-to-upper do leap retained. C key, up one octave. Lyrics and different-pitch slurs omitted. |
| santa-lucia | Same PEP book, printed p.41 / PDF p.46 | Visually inspected and enlarged on 2026-10-22. 3/8, original C4 tonic register retained so F#4 is a draw bend, not F#5 overblow. First eight bars retain repeat signs; second section is expanded with both alternate endings (16 bars). Bar 6 F#–F cancellation is represented by explicit per-note pitches and an automatically printed natural sign. |

Source: https://lywgyxx.szftedu.cn/xkjc/yinyue/202209/P020220910586729125995.pdf

Additional direct sources:
- https://backend.sjhtbook.com/upload/file/2025/04/80fb4b7923894770828045c9e613e236.pdf
- https://trillian.mit.edu/~jc/music/book/EverydaySongBook/018_London_Bridge.abc
- https://trillian.mit.edu/~jc/music/abc/mirror/kirby98.fsnet.co.uk/oh/Oh_Susanna_1.abc
- https://trillian.mit.edu/~jc/music/book/EverydaySongBook/003_Yankee_Doodle.abc
- https://trillian.mit.edu/~jc/music/book/EverydaySongBook/006_My_Bonnie.abc
- https://dev98.oa.henanyuexue.com/static/szjc-resources/pdf/q/f/2/7.pdf

Suggested practice tempi are editorial choices unless the source gives a numerical tempo. Automated checks establish data/rhythm/range consistency; they do not independently prove a transcription matches every folk variant.

## Pending / rejected sources

- Fengyang Flower Drum concern resolved in batch 3 using the PEP edition; see its accepted ledger entry above.
- There's a Hole in the Bucket in the same book: modern introduction/interlude and alternate endings intertwined with the folk tune; seek a simpler original melody source rather than copying an arrangement.
- The school PDF exceeds the web reader's size limit. Downloaded normally, rendered with Poppler; JP2 fallback warnings occurred but page images and notation were visually legible. Detail crop used to investigate ambiguous octave marks.
- Existing source policy's statement that octaveShift does not affect displayed octave dots is obsolete. Stage 2 hotfix/current implementation bakes all shifts into note octaves for consistent notation and pitch.
- Wuxi Jing from Music Appreciation: grace notes and trill need faithful notation support before admission; not silently flattened into an allegedly exact score.
- Deck the Hall ABC in Everyday Song Book: final bar appears half a beat short; needs original-edition comparison before admission.
- Longing for Spring, PEP printed pp.4–5: full continuation inspected, but penultimate-bar grace note needs support before a faithful version can be admitted.
- PEP grade 7 PDF download initially stopped partway; resumed successfully, then verified as 79 readable pages before inspection. National platform PDF was unavailable (403); it was not treated as read.
