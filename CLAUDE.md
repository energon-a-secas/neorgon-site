# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make serve          # Start local dev server on port 8800 (opens http://localhost:8800)
make stop           # Kill the dev server
make check          # Icon standard: lint + regenerate docs/icon-sheet.html, non-zero if off
make hooks          # Opt in to the pre-commit icon check (per-clone, run once)

npx convex dev      # Run Convex backend (required for terminal auth features)
```

Card icons are masked `<span>`s that take their card's `--card-accent`; the four third-party
brand marks stay `<img>`. `scripts/icon-lint.py` enforces both the file rules and which of
the two an icon uses. Details and reasoning: `docs/ICONS.md`.

No build step — open `index.html` directly or serve via `make serve`. ES modules are not used here; all scripts are plain `<script>` tags loaded in `index.html`.

## Architecture

Single-page hub at `neorgon.com` listing all Neorgon tools. The page is a single `index.html` (~1,600 lines) with separate JS modules in `js/` and styles in `css/style.css`.

### JS modules (all IIFEs or direct DOM manipulation, not ES modules)

| File | Purpose |
|------|---------|
| `starfield.js` | Animated canvas starfield (200 stars) — default background |
| `matrix.js` | Matrix rain canvas — alternate background mode |
| `intervention.js` | "Death Note L" CRT broadcast takeover — third background mode |
| `settings.js` | Settings panel: toggles for sound/glow/previews, background picker. Persists to `localStorage` under key `neorgon-prefs` |
| `search.js` | Hero search bar with floating category pills (physics simulation on canvas), **ranked** card filtering, and the route map drawn between pills. Also arrow-key walking + Enter-to-open over the results. `CATEGORIES` must stay 1:1 with the `.card-group` sections in `index.html` — a pill whose `ids` name no group silently filters to zero results. **Ranking:** `scoreCard`/`rank` give every match a score (name-exact 1000 → loose 120) and `syncCatalogMerge` appends in that order, so the merged grid *is* the ranking; ship date breaks ties, newest first. A category's `keywords` blob is a **fallback vocabulary**, not an amplifier — it only expands a group when the query matched no card directly (`cheatsheet` may mean DevOps; `parla` may not mean all of Social). A category *label* always expands, because that is the pill-click path. **Pills stay up during a search:** matched ones travel to the middle and light their routes, the rest recede to 16% and hover back to full. `paintPillStates()` is called from `doFilter`, not only from the rAF loop, so the states still read under `prefers-reduced-motion` where the loop stops after one frame |
| `recent.js` | "Recently shipped" rail above the catalog. Reads `data-added="YYYY-MM-DD"` off each card, renders the newest 6 as clones, and stamps a self-expiring `New` badge (30 days) on the canonical card. Also owns the shelf-overflow observer that toggles `.is-scrollable` on **both** shelf grids — the trailing mask fade must not appear over a row that already fits. Exposes `window._neoRecent` for the terminal's `new`, and **`window._neoMakeEcho(card)`** — the one definition of a safe clone (retag `data-card-id` → `data-echo-id`, clear entrance.js's inline delay, convert a multi-tool card to a link). Any shelf that clones catalog cards must use it |
| `favorites.js` | "Your favorites" shelf above the rail, from `localStorage` key `neorgon-favorites` (`[{ id, pinned }]`; a bare id array is the v1 shape and still loads). Injects the control strip into every catalog card and every echo, prunes saved ids whose card no longer exists (and persists the prune), and renders the shelf with `_neoMakeEcho`. Pin holds the front; drag and ArrowLeft/ArrowRight reorder within a band. Exposes `window._neoFavorites` for the terminal's `fav` / `favs` / `pin`. **Never touches the catalog** — the categories below are byte-for-byte what a first-time visitor sees |
| `catnav.js` | Sticky category rail with live counts and scroll-spy. Owns the sticky-chrome offset for the whole page: sets `--cat-rail-top` and every group's `scroll-margin-top` from one measurement, which `terminal.js` `open <cat>` relies on |
| `palette.js` | ⌘K / Ctrl+K command palette over every tool (fuzzy match, recency tie-break) |
| `cards.js` | Multi-tool card popup (for cards with sub-tools) and ghost card unlock logic |
| `previews.js` | GIF previews on card hover after 1.2s delay — enabled only when `window._neoPreviewsEnabled` is true |
| `sortable.js` | Per-group card drag-reorder using SortableJS CDN. `window.exportCardOrder()` / `window.importCardOrder()` helpers available in console |
| `music.js` | Web Audio API ambient music synced to background mode (stars/matrix/intervention) |
| `sound.js` | UI sound effects — exposes `window._neoSound` with `.dragStart()`, `.dropCard()`, `.unlock()`, and `window._neoSoundPing(freq, vol)`, `window._neoSoundDiscover()` |
| `cursor.js` | Custom cursor glow element |
| `entrance.js` | Card entrance stagger. Delays are **per group and capped** (8 × 55ms), not a global `index × 110ms` timeline — the old form grew with the catalog (5.4s at 50 cards) and leaked into the rail, because recent.js clones these cards and `cloneNode` copies the inline `animation-delay`. recent.js now clears that on every echo; do not reintroduce a global counter here |
| `hero.js` | Hero typewriter (one of four completions for "Made to fit ___", picked per load), the rotating badge, and the scroll cue — the chevron pair under the constellation. The cue retires permanently on the first scroll of any size and never returns |
| `terminal.js` | Hidden terminal (keyboard shortcut) with Convex auth for admin commands. Navigation/discovery commands (`tools`, `goto`, `open`, `whois`, `new`, `stats`, `random`, `search`) build their catalog from the DOM, so a new card needs no terminal edit. `theme` sets the *visitor's* cookie via `NeoHeader.setTheme` only — changing the fleet-wide CDN default belongs in an ops console, not a page anyone can open |
| `codes.js` | Easter eggs: Konami code (warp drive), other sequences |
| `secret.js` | Proximity sonar scanner revealing a hidden section |

### Global window flags (cross-module communication)

- `window._neoSoundEnabled` — boolean, set by settings.js
- `window._neoPreviewsEnabled` — boolean, set by settings.js
- `window._neoSound` — sound effect object from sound.js
- `window._neoSoundPing(freq, vol)` — from sound.js
- `window._neoSoundDiscover()` — from sound.js
- `window._neoMakeEcho(card)` — from recent.js, the safe-clone helper both shelves use
- `window._neoFavorites` — from favorites.js: `{ list(), has(id), isPinned(id), toggle(id), pin(id), clear() }`. `toggle` and `pin` return `true` on / `false` off / **`null` when the id names nothing in the catalog** — three outcomes, because `false` for both "removed" and "not a tool" is how a caller reports a removal that never happened. `pin` on an unsaved tool saves it in the same gesture
- `window._neoMusicSwitch(mode)` — from music.js, called by settings.js when background changes
- `window._neoBgSync(mode)` — from settings.js, called by terminal.js to sync picker state
- `window.matrixOn/Off/Kill`, `window.interventionOn/Off/Kill` — canvas control from matrix.js / intervention.js

### Convex backend

Used only by `terminal.js` for a hidden admin terminal. Schema in `convex/schema.ts`:
- `users` table: `username`, `passwordHash` (indexed by username)
- `loginAttempts` table: rate-limit tracking per identifier

The Convex HTTP client is lazy-loaded via `esm.sh` only when the terminal is opened. Convex URL: `https://quaint-cobra-151.convex.cloud`.

### Card data model

Each tool card in HTML has:
- `data-card-id` — unique slug matching `PREVIEW_MAP` in previews.js and `CATEGORIES` in search.js
- `data-added="YYYY-MM-DD"` — the day it shipped. Drives the Recently shipped rail and the self-expiring `New` badge (recent.js); no separate list to maintain
- `data-status="soon"` — the tool's subdomain is reserved but serves nothing yet. The card is a `<div class="site-card soon-card">` with a `.soon-badge` where the arrow goes, **no `href`** (so it cannot navigate to a 404) and **no `data-added`** (nothing shipped). One attribute, read by every module that counts or navigates: the hero count and the search denominator skip it, the rail and the `New` badge skip it, palette.js shows a Soon chip and scrolls to the card instead of opening it, terminal.js keeps it out of `liveTools()` and has `goto` report the state. Search still finds it, and the search line reads `N of M tools · 1 coming soon`. To ship it: `<div>` → `<a href>`, badge → `.card-arrow`, drop `data-status`, add `data-added`
- `.card-name`, `.card-desc`, `.card-domain`, `.card-tag` — searchable text fields
- `--card-glow` / `--card-accent` CSS custom properties — per-card neon colour

`data-card-id` is the join key across search.js, previews.js, cards.js and sortable.js. The rail's clones therefore carry **`data-echo-id`** instead — same value, different attribute — which is what keeps a cloned card out of the search index, the drag-reorder, and the "N of M tools" count. Anything that walks cards should either scope itself to `#tools` or filter out `.site-card--echo`.

Multi-tool cards (`.site-card.multi-tool`) show a `.card-subtool-popup` on click. Ghost cards (`.ghost-card`) are locked until clicked, then play an unlock sound.

### Shelves above the catalog

Two sections sit between the hero and `#tools`, both hidden until they have
something to show, both built from **clones** via `_neoMakeEcho`:

| Shelf | Source | Owner |
|---|---|---|
| Your favorites | `localStorage` → `neorgon-favorites` | the visitor |
| Recently shipped | each card's `data-added` | us |

**Both are one horizontal row, at every width.** They used to lay out as a
3-column grid, so six cards became two rows and 609px of shelf — which pushed
the category rail to y=1297, two screens down, with the catalog behind it. A
shelf is a glance; the grid directly below it is the destination. Four cards
fit at 1160px and the fifth peeks, which is the affordance; the trailing mask
fade only appears when there is actually something off to the right
(`.is-scrollable`, set by the observer at the end of `recent.js`).

Clones carry `data-echo-id`, never `data-card-id`, which is what keeps them out
of the search index, the "N of M tools" count, the drag-reorder, the command
palette and the terminal's catalog. **Favoriting a tool must not move a number
on the page** — if it does, something started counting `.site-card` without
either scoping to `#tools` or filtering `.site-card--echo`.

**The control strip** (`.card-tools`) sits bottom-right, opposite the arrow —
the arrow means "go there", the strip means "keep this", and the two never
share a corner. It holds the star, the pin (only on a saved card) and, in the
favorites shelf, a drag handle. Secondary controls collapse to zero width at
rest and grow on hover, so the pill is only as wide as it has something to say.
A saved card keeps its strip visible at rest — that is the state readout.

Each control is a `<span role="button" tabindex="0">`, not a `<button>`,
because a card is an `<a>` and nesting a button in a link is invalid. Clicks
are intercepted and `stopPropagation()`d so activating one never follows the
link, the same interception `cards.js` uses for multi-tool cards. Known
trade-off: a screen reader announces buttons inside a link. The alternative was
wrapping all 50 cards in a slot element, which breaks the card reparenting in
`search.js` and the drag targets in `sortable.js`.

**Saved / pinned are border states, not just icons** — a warm rim plus the
card's existing `::after` top hairline held on, and for pinned a brighter rim
and a corner wash. That reads across a grid at a glance; a 15px star does not.

**Ordering.** Favorites store as `[{ id, pinned }]` (a bare array of ids is the
v1 shape and still loads). Pinned sort to the front; drag and the arrow keys
both reorder *within* a band, never across it — `onMove` refuses the crossing
live, so a card stops at the edge instead of snapping back after the drop.

`Sortable.create` on the shelf sets **`forceFallback: true`**, unlike
`sortable.js` on the catalog. These cards are anchors, and native HTML5
drag-and-drop on an anchor is the browser's own "drag this link" gesture
competing for the same motion. The fallback path never starts a native drag.
It is also the only path a synthetic pointer sequence can exercise, so the
drag is testable.

### User preferences

Stored in `localStorage` key `neorgon-prefs`:
```json
{ "sound": true, "glow": true, "previews": false, "bg": "stars" }
```
`bg` values: `"stars"` | `"matrix"` | `"intervention"`

### Adding a new tool card

1. Add card HTML in `index.html` with a unique `data-card-id`, a `data-added="YYYY-MM-DD"` ship date, appropriate `--card-glow`/`--card-accent`, and an SVG icon in `assets/icons/`.
2. Add the card ID to the relevant category in `CATEGORIES` array in `search.js` — the one whose `ids` list matches the `.card-group` the card actually sits in. A card missing from every list is unreachable by pill.
3. Add a GIF path to `PREVIEW_MAP` in `previews.js` and place the GIF in `assets/previews/`.
4. Register the new icon file in `assets/icons/`.

The rail, category chips, palette and terminal all read the DOM, so they pick the card up with no further edits. The hero tool count is computed too — don't hardcode it.

If the subdomain is reserved but nothing is served there yet, add it as a **Soon card** instead (`data-status="soon"`, see the card data model above) and skip steps 3. A card that links to a domain we have not published sends visitors to a 404; a Soon card says so on its face and cannot.

### Required scripts for all HTML pages

Every HTML page must include these scripts immediately after the charset meta tag:

1. **Plausible Analytics** (privacy-first):
```html
<!-- Privacy-first analytics -->
<script defer data-domain="neorgon.com" src="https://plausible.io/js/script.js"></script>
```

2. **Google Analytics** (gtag.js):
```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-HTF349S8R5"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-HTF349S8R5');
</script>
```

**Note:** When adding Google Analytics, update the Content Security Policy to include:
- `https://www.googletagmanager.com` and `https://www.google-analytics.com` in `script-src`
- `https://www.google-analytics.com` and `https://www.googletagmanager.com` in `img-src` and `connect-src`
