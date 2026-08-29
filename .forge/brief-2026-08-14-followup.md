# Brief: Close the five items left open by the search/icon run: port drift, chip-row wrap on mobile, a stale icon doc, icons still ignoring their card accent, and two motion behaviours never verified in a real browser

Started 2026-08-14 00:22. Maintained by the `task` skill; read by `debrief` and `writeup`.

## Problem

Close the five items left open by the search/icon run: port drift, chip-row wrap on mobile, a stale icon doc, icons still ignoring their card accent, and two motion behaviours never verified in a real browser

<!-- What was wrong *before*. The symptom someone actually experienced, not the
     absence of the solution. debrief opens its deck on this, so vagueness here
     costs a slide later. -->

## Approach

<!-- What you are doing, in a paragraph. -->

## Rejected

**A "+2 more" affordance for the chip row on mobile.** The obvious answer to five chips wrapping
to two lines. Rejected because it needs JS to count what fits, invents an interaction nobody asked
for, and hides information the reader can already reach by dragging. `.cat-rail-inner` two hundred
lines away already solved the identical problem with a hidden-scrollbar strip; reusing it costs
nine lines of CSS and no new concepts.

**Inlining the SVGs into index.html so `currentColor` would work.** The other way to get per-card
colour, and it avoids the mask entirely. Rejected on two counts: it adds roughly 18KB to a file
already at 97KB, and it makes `assets/icons/*.svg` and the markup two copies of the same drawing,
so the linter would be checking files the page no longer renders. The mask keeps one source of
truth per icon.

**Regenerating `docs/icon-comparison.html` instead of deleting it.** Its purpose was comparing
candidate Lucide icons against what was in use, which `scripts/icon-sheet.py` now does over the
whole set and without a CDN. Keeping both would leave two pages claiming to show the icon system.

**Leaving the post's "Where it still breaks" list as published and adding an addendum.** Normally
the right call, because rewriting a shipped claim erases the record. Not here: nothing has been
committed or deployed, so the post has never been public and there is no record to preserve. It
was rewritten to describe the final state instead.

## Decisions

<!-- Appended by: brief.sh note "<what you learned>" -->

- `2026-08-14 00:22` stream **port-drift** done: Makefile PORT 8877 -> 8800 and the matching line in the project's CLAUDE.md; scripts/repo-tools.sh get_port() is canonical and was already right. No other 8877 in live files.

- `2026-08-14 00:22` The published post's 'Where it still breaks' list names four items as open. Fixing them makes the post wrong, so blog/everything-on-the-page-was-correct.html and post/POST-correct-and-wrong.md must be reconciled before this run closes.

- `2026-08-14 00:23` stream **chip-row** done: One scrollable line at <=600px, borrowing the hidden-scrollbar pattern .cat-rail-inner already uses. No '+N more' affordance invented.

- `2026-08-14 00:27` stream **icon-accent** done: 49 card icons converted from <img> to masked <span role=img aria-label>, taking var(--card-accent); 4 third-party brand marks and the raster logo stay <img>. Guarded with @supports. One defect found and fixed: a relative url() inside a custom property resolves against the stylesheet that substitutes the var(), not the HTML that declared it, so all 49 masks 404'd as /css/assets/... until the paths were made root-relative.

- `2026-08-14 00:28` stream **icon-sheet** done: scripts/icon-sheet.py generates docs/icon-sheet.html from index.html + the icon dir: all 54 card icons at 60px and 28px, each in its own card's accent, raw brand marks flagged. Stale docs/icon-comparison.html removed (git 0e3afe3). First attempt bracketed cards by regex and found 29 of 54 because Soon and multi-tool cards are <div>; rewritten to anchor on the icon and walk back to the nearest --card-accent.

- `2026-08-14 00:30` stream **motion-proof** done: Confirmed in Playwright (real Chromium, rAF running at 126fps, 11 pills booted). Constellation collapse eased 200 -> 147.7 -> 77.5 -> 25.5 -> 11.4 -> 0 over ~320ms, matching the 0.3s transition. Reveal scroll animated 0 -> 291 and landed exactly on the computed target of 291. Mobile chip row at the worst case (11 chips): 23px, one line, scrollable, no sideways body scroll.

- `2026-08-14 00:36` Converting the icons to spans broke both checkers silently: icon-lint.py matched only <img> and reported 'all 0 linted icons on standard' with exit 0, and the diagram generator charted NaN while still writing a PNG. Both now match img|span AND refuse to pass on a suspiciously small match; the regression was reproduced deliberately to watch them exit 2.

- `2026-08-14 00:36` Icons are aria-hidden now rather than carrying aria-label. The label repeated the card's own name, so the link's accessible name read 'Pathfinder pathfinder.neorgon.com Pathfinder'. The old <img alt> had the same defect; it was never a regression, just never noticed.

## Measured

**Chip row, 375x812, worst case (query "e", 11 matched categories).** Two wrapped lines of
52px became one scrollable line of 23px; `distinctRows` = 1, `scrollWidth > clientWidth`,
and `document.scrollWidth` still equals the viewport (the negative margin does not leak a
horizontal scrollbar).

**Motion, verified in Playwright/Chromium** (rAF confirmed live at 126 frames/s, 11 pills
booted; the preview pane throttles rAF, which is why these were unproven before):

| | samples |
|---|---|
| constellation height, px | 200 -> 147.7 -> 77.5 -> 25.5 -> 11.4 -> 7.4 -> 0 (~320ms, matches the 0.3s transition) |
| reveal scroll, px | 0 -> 2 -> 16 -> 123 -> 192 -> 213 -> 281 -> 288 -> 291 |
| computed scroll target | 291 (exact match) |

**Icons after the accent change.** 49 masked spans + 4 brand `<img>` + 1 raster logo = 54.
Search for "json" returns 7 matches showing 7 distinct icon colours. Search gap unchanged
at 195px. `icon-lint.py` 49/49 on standard.

**The false pass.** With the span markup unmatched, `icon-lint.py` printed
"all 0 linted icons on standard" and exited 0. After the guard, the same simulated regression
exits 2 with "only 0 icons matched in index.html".

## Open

- **Masked icons depend on `mask-image`.** Universally supported today, and an `@supports`
  block makes a non-supporting engine paint nothing rather than a solid 28px colour block.
  "Nothing" is still worse than the `<img>` it replaced. Accepted deliberately.
- **The four third-party brand marks do not follow the accent rule**, by design. They are
  visible exceptions to the sentence the whole change is built on.
- **The SVG files still carry `stroke="#E326E4"` that the hub never reads** (a mask uses alpha
  only). It is the standalone-view colour and the linter still enforces it, which is defensible
  and also a second source of truth.
- **Nothing runs the checks automatically.** `icon-lint.py` and `icon-sheet.py` both have to be
  remembered. A pre-commit hook would close this; not added, because hooks in this repo are a
  fleet-level decision rather than a per-project one.
- **`docs/icon-comparison.html` was deleted**, recoverable at git 0e3afe3 if the 21-icon
  Lucide-CDN version is ever wanted back.

_Closed 2026-08-14 00:36._
