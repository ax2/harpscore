# Stage 5 library usability — 2026-10-22

The 20-score library now supports combined search terms (title, subtitle, composer and tags), maximum difficulty, exact tag, natural-note/bend filters, difficulty/title ordering and local favorites. Counts show visible/total entries and an empty result explains how to reset. The currently open score remains readable when it no longer matches the filter.

The natural-note filter uses prepared fingering and excludes unplayable notes and overblows as well as bends. Favorite IDs persist separately from imported scores; a failed write leaves the visible favorite state unchanged and reports the error. Filters reset on reload; favorites persist in the current browser, without account sync.

Validation: 35 automated tests and production build pass. Chromium desktop 1440×1000 and mobile 390×844 exercise combined filters, empty results, reset, favorite/unfavorite, reload persistence and forced storage rejection. The first browser run exposed an ambiguous accessible name on the sort selector; explicit labels fix it. A screenshot taken during sidebar animation was replaced after waiting for its final position; final screenshots were visually inspected.

This increment adds no new melodies. Source expansion remains active and daily 02:00 Beijing pause remains configured.
