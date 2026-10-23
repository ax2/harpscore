# Music-only reference fixtures

Source collection: https://trillian.mit.edu/~jc/music/book/EverydaySongBook/

The Everyday Song Book, 12th edition (1927); ABC transcriptions by John Chambers (2015/2017). Read on 2026-10-23. Each filename is the final component of its source URL. Headers retain title, attribution, book, transcriber, meter, unit length and key. Lyrics, prose notes and comments were omitted; music tokens and their line/bar boundaries are unchanged.

The reference ABC is decoded independently of the handwritten HarpScore melody DSL. This is intentionally not a general-purpose ABC importer. Unsupported syntax fails the comparison. See `../../stage7Sources.test.ts` and `../../../docs/sources/stage-7-library.md` for explicit repeat/pickup adaptations and verification limits.
