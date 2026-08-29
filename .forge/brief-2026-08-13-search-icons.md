# Brief: Search results sit ~2100px below the search box behind favorites/recent; hub icons vary 2.7x in effective stroke weight under a blanket magenta glow

Started 2026-08-13 23:17. Maintained by the `task` skill; read by `debrief` and `writeup`.

> **SUPERSEDED IN PART: read this first.** Every browser measurement in this brief was
> taken in a preview pane that throttles `requestAnimationFrame`. `createPills` never ran
> there, so the search's category-level match pass never fired and the page reported far
> fewer matches than it really has (`json` = 7 in the pane, 22 in a real browser). The
> headline figures below (**1816px -> 195px, 9.3x**) are wrong. Re-measured in
> Playwright/Chromium under identical conditions: **1747px -> 126px, 13.9x**. See
> the newest brief in `.forge/` (currently `brief.md`) for the corrected table and the cause.
> The rest of this brief: the decisions, what was rejected, what was found, still stands.
## Problem

Search results sit ~2100px below the search box behind favorites/recent; hub icons vary 2.7x in effective stroke weight under a blanket magenta glow

<!-- What was wrong *before*. The symptom someone actually experienced, not the
     absence of the solution. debrief opens its deck on this, so vagueness here
     costs a slide later. -->

## Approach

Two independent workstreams, both inline (they touch disjoint files, but the session
forbids subagents).

**search-layout.** The hub stacks hero → constellation pills → favorites shelf → recently-shipped
rail → sticky category rail → catalog. All five survive a search, so the merged results grid opens
~2100px below the search field. Fix: treat search as a *mode*, not a filter. On `body.search-active`
the three browse surfaces (favorites, recent, category rail) leave the flow entirely, the
constellation collapses to zero height, and the search field becomes sticky under the header so it
stays reachable while walking results. Nothing is lost by hiding favorites/recent: both hold
`.site-card--echo` clones of catalog cards, and the merged grid already collects every match from
the catalog itself. The pill signal that *is* lost, "your query matched the DevOps category", is
re-surfaced as compact chips beside the result count, which costs ~26px instead of 200.

**icon-system.** Effective stroke at the 28px render size is `stroke-width / viewBox-size x 28`.
The set spans 0.88px (64-viewBox at sw=2) to 2.33px (the 24-viewBox majority at sw=2). A 2.7x
spread that reads as "some icons are faint". On top of that every icon carries
`drop-shadow(0 0 3px rgba(227,38,228,.7))`, a 3px magenta blur that smears a 2px line. Fix: define
one ratio (sw/viewBox = 1/11, giving ~2.55px effective, deliberately above today's 2.33px baseline
because the ask was "bolder"), set every icon's stroke-width from it, and redraw the icons whose art
is too dense to carry the heavier line. Replace the blur with a tight offset shadow that separates
the icon from the tile without softening it.

## Rejected

**Recolouring icons to their card accent via CSS mask.** Technically the strongest version of
"bolder and sharper": a saturated accent-filled shape beats a magenta line under a blur, and it
would make icon, domain text, group dot and hover glow finally agree per card. Not taken: the ask
was to sharpen the icons, not to change what colour the hub is, and masking discards the artwork's
own tones (Proctor's filled clipboard clasp, Resume Forge's two-tone). Cheap to add later. The
weight normalisation done here is a prerequisite for it either way.

**Filtering the favorites shelf and recent rail in place instead of hiding them.** Keeps every
surface on screen and "searches everything". Rejected because both rails render `.site-card--echo`
clones of catalog cards, so a filtered favorites shelf shows the *same* card the merged grid is
already showing one section below: the user reads each match twice and the vertical cost is
unchanged, which is the actual complaint.

**Making the whole hero sticky rather than just the search field.** Would keep the heading and
count visible together. Rejected on height: the hero is 604px, more than half a 720px viewport.

## Decisions

<!-- Appended by: brief.sh note "<what you learned>" -->

- ~~`2026-08-13 23:25` Verified at 1280x800: search field bottom 428 -> first match top 835 pre-collapse, ~635 after the constellation settles, vs 2919 before the change. fav shelf (890px), recent rail (1033px) and cat rail (58px) all leave the flow.~~ · superseded 2026-08-13 23:38, see correction below

- `2026-08-13 23:25` The browser pane throttles rAF, which froze both the pill init and the height transition mid-flight. Not a site bug, but it exposed one: renderCategoryChips originally read the pills' matched flags, so the chip row rendered empty wherever pills never booted. Rewritten to derive matches from CATEGORIES + the query directly.

- `2026-08-13 23:25` revealResults guarded with 'target <= scrollY' so it only ever scrolled down; searching from halfway into the catalog silently did nothing. Now scrolls in whichever direction the field is.

- `2026-08-13 23:26` stream **search-layout** done: browse surfaces leave the flow on search-active; constellation collapses; matched-category chips replace the pill signal at ~24px; reveal-scroll parks the field under the header. Two defects found and fixed while building: chips coupled to rAF-gated pill init, and a one-directional scroll guard.

- `2026-08-13 23:36` Wrong earlier: I told the user there was no canonical icon spec. docs/ICONS.md is one, Lucide, 24x24, stroke 2, #E326E4, no fixed width/height. The set had drifted off its own documented standard, which reframes this work as enforcement rather than invention. Choosing stroke 2.2 for boldness is now a deliberate deviation and has to be written back into that doc, or the next person restores 2.

- `2026-08-13 23:36` safeguard.svg and lockdown.svg were byte-identical (same half-filled shield on two different security tools). anatomy.svg drew its bars in currentColor, which in an <img> resolves to black. The icon was near-invisible on a dark card. Neither was in the brief; both found by rendering the set as a contact sheet.

- `2026-08-13 23:38` CORRECTION of the struck note above: Controlled measurement, both states at 1280x800 with 6 favorites saved and query 'json', pre-change layout restored by neutralising only the new rules: distance from the bottom of the search field to the top of the first matching card was 1816px before and 195px after, 9.3x. Earlier figures in this brief (2100/2491) came from snapshots taken at different viewport widths and are not comparable.

- `2026-08-13 23:38` Measured unit is the vertical gap between the search field's bottom edge and the first matching card's top edge, not page height, which barely moves, and not scroll position, which depends on where the reader was.

- `2026-08-13 23:39` stream **icon-system** done: 49 card icons on one standard, enforced by scripts/icon-lint.py; 17 redrawn on the 24-unit grid; blanket magenta blur replaced with a 1px dark separation shadow; docs/ICONS.md rewritten to match. Three of the redraws needed a second pass (doorman read as a trash can, resume-forge as a laptop, anatomy as a third document icon), caught only by rendering the whole set as a contact sheet, not by looking at files.

- `2026-08-13 23:39` stream **new-badge** done: Solid amber gradient + 12px amber glow -> the accent-keyed outlined pill that .soon-badge already used, one step louder (18% fill / 55% border / full-opacity dot). Now green on Planning cards, blue on CardForge, rose on SafeGuard.

- `2026-08-13 23:39` Left alone deliberately: the Makefile says PORT ?= 8877 while scripts/repo-tools.sh get_port() assigns neorgon-site 8800, and docs/icon-comparison.html is a stale 745-line page covering 21 icons that loads Lucide from a CDN. Both out of scope for this run.

- `2026-08-13 23:50` stream **writeup** done: post/POST-correct-and-wrong.md (2017 words) + 3 diagrams whose numbers are parsed from git HEAD vs working tree; published as blog/everything-on-the-page-was-correct.html and registered in the index, RSS and Atom. Sitemap left alone: it lists subdomains, not posts.

## Measured

<!-- Numbers you actually observed, with how you got them. An estimate recorded
     here becomes a false claim on a slide, so mark estimates as estimates. -->

**Search reveal.** Vertical distance from the bottom edge of the search field to the top edge
of the first matching card. Chrome, 1280x800, 6 favorites saved, query `json`. Both states
measured in the same session; the "before" restored by injecting a stylesheet that neutralises
only the new rules, so viewport and query are identical.

| | before | after |
|---|---|---|
| gap, search field to first match | **1816px** | **195px** |
| favorites shelf in the flow | 580px | 0 |
| Recently shipped rail | 586px | 0 |
| category rail | 58px | 0 |
| constellation box | 200px | 0 |
| matched-category chips | none | 24px (52px wrapped, at 375px wide) |

Mobile (375x812): gap 235px, first match top at 610px, inside the fold.

**Icon stroke weight.** Effective stroke at the 28px render size is
`stroke-width / viewBox-size * 28`. Computed by parsing every file the linter covers.

| | before | after |
|---|---|---|
| range across 49 card icons | 0.88px – 2.33px (**2.7x spread**) | 2.567px, all 49 |
| icons off their own documented standard | 49 of 49 | 0 |
| icons redrawn on the 24-unit grid | none | 17 |
| icons rendering black (`currentColor` in an `<img>`) | 3 | 0 |
| byte-identical duplicate glyphs | 2 (safeguard, lockdown) | 0 |

## Open

- **Chip row wraps at 375px.** Five matched categories become two lines, 52px instead of 24px.
  Cheap against the 1816px removed, but not free. A "+2 more" affordance was judged more code
  than it is worth until someone complains.
- **Icons remain fleet magenta, not per-card accent.** Rendering them through a CSS mask so each
  takes its card's `--card-accent` is the strongest version of "bolder and sharper" and was not
  done: the ask was to sharpen the icons, not to change the hub's colour. The weight
  normalisation is a prerequisite either way, so the job is smaller now. Needs a decision on the
  4 third-party marks, which must not be recoloured.
- **`docs/icon-comparison.html` is stale.** 745 lines covering 21 of 49 icons, loading Lucide
  from a CDN. Left as found; superseded in practice by `scripts/icon-lint.py`.
- **Port drift.** `Makefile` says `PORT ?= 8877`; `scripts/repo-tools.sh` `get_port()` assigns
  neorgon-site 8800. Two sources, one wrong. Noticed in passing, deliberately not fixed here.
- **Not verified in a real browser:** the constellation's collapse *transition* and the
  reveal scroll's smooth animation. Both are rAF-driven and the preview pane throttles rAF, so
  only their end states were confirmed (height 0, correct scroll target). The end states are
  what matter for layout; the easing is unproven.

_Closed 2026-08-13 23:50._
