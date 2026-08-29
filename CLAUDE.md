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

No build step: open `index.html` directly or serve via `make serve`. ES modules are not used here; all scripts are plain `<script>` tags loaded in `index.html`.

## Architecture

Single-page hub at `neorgon.com` listing all Neorgon tools. The page is a single `index.html` (~1,600 lines) with separate JS modules in `js/` and styles in `css/style.css`.

### JS modules (all IIFEs or direct DOM manipulation, not ES modules)

| File | Purpose |
|------|---------|
| `starfield.js` | Animated canvas starfield (200 stars): default background |
| `matrix.js` | Matrix rain canvas: alternate background mode |
| `intervention.js` | "Death Note L" CRT broadcast takeover: third background mode |
| `settings.js` | Settings panel: toggles for sound/glow/previews, background picker. Persists to `localStorage` under key `neorgon-prefs` |
| `search.js` | Hero search bar with floating category pills (physics simulation on canvas), **ranked** card filtering, and the route map drawn between pills. Also arrow-key walking + Enter-to-open over the results. `CATEGORIES` must stay 1:1 with the `.card-group` sections in `index.html`. A pill whose `ids` name no group silently filters to zero results. **Ranking:** `scoreCard`/`rank` give every match a score (name-exact 1000 → loose 120) and `syncCatalogMerge` appends in that order, so the merged grid *is* the ranking; ship date breaks ties, newest first. A category's `keywords` blob is a **fallback vocabulary**, not an amplifier. It only expands a group when the query matched no card directly (`cheatsheet` may mean DevOps; `parla` may not mean all of Social). A category *label* always expands, because that is the pill-click path. **Pills stay up during a search:** matched ones travel to the middle and light their routes, the rest recede to 16% and hover back to full. `paintPillStates()` is called from `doFilter`, not only from the rAF loop, so the states still read under `prefers-reduced-motion` where the loop stops after one frame |
| `recent.js` | "Recently shipped" rail above the catalog. Reads `data-added="YYYY-MM-DD"` off each card, renders the newest 6 as clones, and stamps a self-expiring `New` badge (30 days) on the canonical card. A `.card-group` carrying **`data-recent="off"`** is skipped by **both** recency surfaces, the rail and the badge, because one candidate list feeds both. Applied to **UI Lab**: those are reference tools, and a visitor scanning for what changed should not be handed a wireframe glossary as news. Group-level rather than per-card so the next reference category needs an attribute, not an edit. Archived cards are skipped too. Also owns the shelf-overflow observer that toggles `.is-scrollable` on **both** shelf grids, and the rAF-gated scroll listeners that toggle `.is-scrolled` (the desktop breakout's leading fade and lit column edge). The trailing mask fade must not appear over a row that already fits, and the leading fade must not appear at rest. Exposes `window._neoRecent` for the terminal's `new`, and **`window._neoMakeEcho(card)`**. The one definition of a safe clone (retag `data-card-id` → `data-echo-id`, clear entrance.js's inline delay, convert a multi-tool card to a link). Any shelf that clones catalog cards must use it |
| `favorites.js` | "Your favorites" shelf above the rail, from `localStorage` key `neorgon-favorites` (`[{ id, pinned }]`; a bare id array is the v1 shape and still loads). Injects the control strip into every catalog card and every echo, prunes saved ids whose card no longer exists (and persists the prune), and renders the shelf with `_neoMakeEcho`. Pin holds the front; drag and ArrowLeft/ArrowRight reorder within a band. Exposes `window._neoFavorites` for the terminal's `fav` / `favs` / `pin`. **Never touches the catalog**. The categories below are byte-for-byte what a first-time visitor sees |
| `catnav.js` | Sticky category rail with live counts and scroll-spy. Owns the sticky-chrome offset for the whole page: sets `--cat-rail-top` and every group's `scroll-margin-top` from one measurement, which `terminal.js` `open <cat>` relies on |
| `collapse.js` | Collapsible `.card-group` sections. A group carrying `data-collapsed="true"` ships closed and grows a toggle on its own heading. Applied to **Archive** and **Platforms**. The shipped default lives in the HTML; the visitor's choice overrides it in `localStorage` key `neorgon-collapsed`, which stores **only deviations from the default**, so changing a group's shipped default later still reaches everyone who never touched it. Loads **after `catnav.js`** on purpose: catnav builds its chip labels from `.group-label` `textContent`, and this module reparents that heading into a `<button>`. For the same reason the card count is generated content off `data-count` and the chevron is an SVG, neither of which `textContent` can see. Put a text node in that heading and every category chip gains a stray "1 tool". Exposes `window._neoCollapse` |
| `palette.js` | ⌘K / Ctrl+K command palette over every tool (fuzzy match, recency tie-break). Shows an `Archived` chip alongside the existing `Soon` chip |
| `cards.js` | Multi-tool card popup (for cards with sub-tools) and ghost card unlock logic |
| `previews.js` | GIF previews on card hover after 1.2s delay: enabled only when `window._neoPreviewsEnabled` is true |
| `sortable.js` | Per-group card drag-reorder using SortableJS CDN. `window.exportCardOrder()` / `window.importCardOrder()` helpers available in console |
| `music.js` | YouTube IFrame ambient music synced to background mode (stars/matrix/intervention). A `pageshow` handler covers bfcache restores: heap and DOM thaw with `playing` still true but iframe audio stays paused, so it attempts a resume through the same mute-then-unmute path a click uses and drops to an honest off state (class, `aria-pressed`, spin) when the player is not audibly going ~1.2s later |
| `sound.js` | UI sound effects: exposes `window._neoSound` with `.dragStart()`, `.dropCard()`, `.unlock()`, and `window._neoSoundPing(freq, vol)`, `window._neoSoundDiscover()` |
| `cursor.js` | Custom cursor glow element |
| `entrance.js` | Card entrance stagger. Delays are **per group and capped** (8 × 55ms), not a global `index × 110ms` timeline. The old form grew with the catalog (5.4s at 50 cards) and leaked into the rail, because recent.js clones these cards and `cloneNode` copies the inline `animation-delay`. recent.js now clears that on every echo; do not reintroduce a global counter here |
| `hero.js` | Hero typewriter (one of four completions for "Made to fit ___", picked per load), the rotating badge, and the scroll cue. The chevron pair under the constellation. The cue retires permanently on the first scroll of any size and never returns |
| `terminal.js` | Hidden terminal (keyboard shortcut) with Convex auth for admin commands. Opens on an **ASCII login banner** printed once per page load (`banner` / `motd` reprints it; `clear` is allowed to mean clear). The banner reports the live catalog, so it cannot be written into `index.html`. Two wordmarks: the block form is 66 columns and the body is `white-space: pre-wrap` inside a `min(640px, 90vw)` box, so `termColumns()` **measures** the body with a probe span in its own font rather than assuming a character width, and falls back to 80 columns when the body has no layout yet. Get that fallback wrong and a desktop silently gets the phone banner. Stat rows hang-indent to the value column, derived from the same leader width they are printed with. Navigation/discovery commands (`tools`, `goto`, `open`, `whois`, `new`, `stats`, `random`, `search`) build their catalog from the DOM, so a new card needs no terminal edit. `theme` sets the *visitor's* cookie via `NeoHeader.setTheme` only, changing the fleet-wide CDN default belongs in an ops console, not a page anyone can open |
| `codes.js` | Easter eggs: Konami code (warp drive), other sequences |
| `secret.js` | Proximity sonar scanner revealing a hidden section |

### Global window flags (cross-module communication)

- `window._neoSoundEnabled`: boolean, set by settings.js
- `window._neoPreviewsEnabled`: boolean, set by settings.js
- `window._neoSound`: sound effect object from sound.js
- `window._neoSoundPing(freq, vol)`: from sound.js
- `window._neoSoundDiscover()`: from sound.js
- `window._neoMakeEcho(card)`: from recent.js, the safe-clone helper both shelves use
- `window._neoFavorites`: from favorites.js: `{ list(), has(id), isPinned(id), toggle(id), pin(id), clear() }`. `toggle` and `pin` return `true` on / `false` off / **`null` when the id names nothing in the catalog**, three outcomes, because `false` for both "removed" and "not a tool" is how a caller reports a removal that never happened. `pin` on an unsaved tool saves it in the same gesture
- `window._neoCollapse`: from collapse.js: `{ expand(groupId), isOpen(groupId) }`. `expand` opens a collapsed group and returns whether it knew the id. Used by `terminal.js` `open <cat>` so a jump never lands on a heading with nothing under it. Chip clicks and fragment jumps are handled inside collapse.js itself
- `window._neoMusicSwitch(mode)`: from music.js, called by settings.js when background changes
- `window._neoBgSync(mode)`: from settings.js, called by terminal.js to sync picker state
- `window.matrixOn/Off/Kill`, `window.interventionOn/Off/Kill`: canvas control from matrix.js / intervention.js

### Convex backend

Used only by `terminal.js` for a hidden admin terminal. Schema in `convex/schema.ts`:
- `users` table: `username`, `passwordHash` (indexed by username)
- `loginAttempts` table: rate-limit tracking per identifier

The Convex HTTP client is lazy-loaded via `esm.sh` only when the terminal is opened. Convex URL: `https://quaint-cobra-151.convex.cloud`.

### Card data model

Each tool card in HTML has:
- `data-card-id`: unique slug matching `PREVIEW_MAP` in previews.js and `CATEGORIES` in search.js
- `data-added="YYYY-MM-DD"`: the day it shipped. Drives the Recently shipped rail and the self-expiring `New` badge (recent.js); no separate list to maintain
- `data-status="soon"`: the tool's subdomain is reserved but serves nothing yet. The card is a `<div class="site-card soon-card">` with a `.soon-badge` where the arrow goes, **no `href`** (so it cannot navigate to a 404) and **no `data-added`** (nothing shipped). One attribute, read by every module that counts or navigates: the hero count and the search denominator skip it, the rail and the `New` badge skip it, palette.js shows a Soon chip and scrolls to the card instead of opening it, terminal.js keeps it out of `liveTools()` and has `goto` report the state. Search still finds it, and the search line reads `N of M tools · 1 coming soon`. To ship it: `<div>` → `<a href>`, badge → `.card-arrow`, drop `data-status`, add `data-added`
- `data-status="archived"`: the tool still works and the domain is still up, but it is no longer what we would point someone at. The third card state, after live and Soon, and it fails the *opposite* way: a Soon card cannot be opened, an archived card can. It keeps its `href`, its arrow and its `data-added`, and gains an `.archived-badge`, a `.card-superseded` line naming what replaced it, a dashed border, a desaturated icon and a resting dim. It leaves every count that means a recommendation (the hero count, the search denominator, `stats`, `random`, `liveTools()`, the rail and the `New` badge) and stays fully findable: search scores it by name, `goto` and `whois` resolve it, the palette shows an `Archived` chip. The search line gets its own `N archived` segment for the same reason `soon` and `external` have one, a query that puts a card on screen must never report zero. Archived cards live in the **Archive** group at the foot of the catalog. Styling selectors are `.site-card.archived-card`, **not** `.archived-card`: that block sits above `.site-card` in `style.css` and at equal specificity the later rule wins. **The resting dim goes on `.card-content`, never on the card**, via `--card-rest-dim` (`.72` archived, `.78` Soon). Every catalog card runs `cardEnter` with `forwards`, and a filling animation's `to { opacity: 1 }` outranks a normal declaration on the same element, so `opacity` set on `.site-card` is inert. `.soon-card { opacity: .78 }` shipped dead for as long as Soon cards existed, and the hover rule that "restored" it was restoring nothing
- `.card-name`, `.card-desc`, `.card-domain`, `.card-tag`: searchable text fields
- `--card-glow` / `--card-accent` CSS custom properties: per-card neon colour

`data-card-id` is the join key across search.js, previews.js, cards.js and sortable.js. The rail's clones therefore carry **`data-echo-id`** instead, same value, different attribute, which is what keeps a cloned card out of the search index, the drag-reorder, and the "N of M tools" count. Anything that walks cards should either scope itself to `#tools` or filter out `.site-card--echo`.

### Group-level attributes

Set on a `.card-group`, read by the modules named:

| Attribute | Read by | Meaning |
|---|---|---|
| `data-collapsed="true"` | `collapse.js` | Ships closed behind a toggle. On **Archive** and **Platforms** |
| `data-recent="off"` | `recent.js` | Out of the Recently shipped rail **and** the `New` badge. On **UI Lab** and **Archive** |

**The Archive group is deliberately absent from `CATEGORIES` in `search.js`**, which breaks the 1:1 pill/group rule stated above. The rule exists to stop a pill filtering to zero results, and a group with no pill fails in the safe direction: an archived tool is still scored by name, it simply is not something the hero constellation offers. A pill would advertise the one shelf on the page the catalog argues against. `skillmap` was also removed from the Planning pill's `ids`, or clicking Planning would surface an archived tool as a current recommendation.

Multi-tool cards (`.site-card.multi-tool`) show a `.card-subtool-popup` on click. Ghost cards (`.ghost-card`) are locked until clicked, then play an unlock sound.

### Shelves above the catalog

Two sections sit between the hero and `#tools`, both hidden until they have
something to show, both built from **clones** via `_neoMakeEcho`:

| Shelf | Source | Owner |
|---|---|---|
| Your favorites | `localStorage` → `neorgon-favorites` | the visitor |
| Recently shipped | each card's `data-added` | us |

**Both are one horizontal row, at every width.** They used to lay out as a
3-column grid, so six cards became two rows and 609px of shelf, which pushed
the category rail to y=1297, two screens down, with the catalog behind it. A
shelf is a glance; the grid directly below it is the destination. Four cards
fit at 1160px and the fifth peeks, which is the affordance; the trailing mask
fade only appears when there is actually something off to the right
(`.is-scrollable`, set by the observer at the end of `recent.js`).

**Desktop breakout, left side only.** At rest the row is flush with the
1160px column; once scrolled (`.is-scrolled`, same observer file), passed
cards travel into the page margin and dissolve under a leading fade while a
shelf-tone hairline lights the column edge they cross. The left-only shape is
load-bearing: left overflow can never grow a scrollbar and the classic-
scrollbar 100vw error self-cancels for rest alignment. Extend the right side
and both guarantees die (full reasoning in the grid comment in `style.css`).

Clones carry `data-echo-id`, never `data-card-id`, which is what keeps them out
of the search index, the "N of M tools" count, the drag-reorder, the command
palette and the terminal's catalog. **Favoriting a tool must not move a number
on the page**: if it does, something started counting `.site-card` without
either scoping to `#tools` or filtering `.site-card--echo`.

**The control strip** (`.card-tools`) sits bottom-right, opposite the arrow,
the arrow means "go there", the strip means "keep this", and the two never
share a corner. It holds the star, the pin (only on a saved card) and, in the
favorites shelf, a drag handle. The glyphs are unboxed: the surface is per
control (a 28px hit box plus a hover chip each), not a shared pill, and
secondary controls collapse to zero width at rest and grow on hover, so the
row is only as wide as it has something to say. A saved card keeps its star
visible at rest. That is the state readout, together with the gold rim.

**The arrow is also a control**: clicking it opens the tool in a new tab
(delegated capture-phase listener in `cards.js`), while the rest of the card
stays same-tab. It is deliberately pointer-only and `aria-hidden`: Cmd or
Ctrl+Enter on the focused card is the keyboard path to a new tab, and a
focusable arrow would add ~55 tab stops for no new ability. Saving a tool
fires a one-shot discovery burst (`favorites.js` + `.fav-burst` in
`style.css`); the first save ever plays `_neoSoundDiscover`, later saves keep
the quiet ping.

Each control is a `<span role="button" tabindex="0">`, not a `<button>`,
because a card is an `<a>` and nesting a button in a link is invalid. Clicks
are intercepted and `stopPropagation()`d so activating one never follows the
link, the same interception `cards.js` uses for multi-tool cards. Known
trade-off: a screen reader announces buttons inside a link. The alternative was
wrapping all 50 cards in a slot element, which breaks the card reparenting in
`search.js` and the drag targets in `sortable.js`.

**Saved / pinned are border states, not just icons**. A warm rim plus the
card's existing `::after` top hairline held on, and for pinned a brighter rim
and a corner wash. That reads across a grid at a glance; a 15px star does not.

**Ordering.** Favorites store as `[{ id, pinned }]` (a bare array of ids is the
v1 shape and still loads). Pinned sort to the front; drag and the arrow keys
both reorder *within* a band, never across it, `onMove` refuses the crossing
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

Other keys the page owns:

| Key | Owner | Shape |
|---|---|---|
| `neorgon-favorites` | favorites.js | `[{ id, pinned }]` |
| `neorgon-collapsed` | collapse.js | `{ "group-archive": "open" }`, deviations from the shipped default only |
| `neorgon-term-login` | terminal.js | ISO timestamp of the previous terminal open, for the banner's `Last login` |
| `neorgon-ghost` | terminal.js / entrance.js | ids hidden by the admin `ghost` command |

### Adding a new tool card

1. Add card HTML in `index.html` with a unique `data-card-id`, a `data-added="YYYY-MM-DD"` ship date, appropriate `--card-glow`/`--card-accent`, and an SVG icon in `assets/icons/`.
2. Add the card ID to the relevant category in `CATEGORIES` array in `search.js`. The one whose `ids` list matches the `.card-group` the card actually sits in. A card missing from every list is unreachable by pill.
3. Add a GIF path to `PREVIEW_MAP` in `previews.js` and place the GIF in `assets/previews/`.
4. Register the new icon file in `assets/icons/`.

The rail, category chips, palette and terminal all read the DOM, so they pick the card up with no further edits. The hero tool count is computed too, don't hardcode it.

If the subdomain is reserved but nothing is served there yet, add it as a **Soon card** instead (`data-status="soon"`, see the card data model above) and skip steps 3. A card that links to a domain we have not published sends visitors to a 404; a Soon card says so on its face and cannot.

### Archiving a tool

When a tool is superseded but the domain stays up (Skill Map, replaced by Pathfinder):

1. Move the card into the **Archive** group at the foot of `index.html`. Keep the `href` and `data-added`, add `data-status="archived"` and the `archived-card` class, and recolour `--card-glow` / `--card-accent` to the archive grey `#8b8fa3`.
2. Swap the tags row's neighbour: add an `.archived-badge` in `.card-top` before the arrow, and a `.card-superseded` line saying what replaced it and why. Name the replacement, "deprecated" on its own tells a visitor nothing about where to go instead.
3. Remove the id from its old category's `ids` in `CATEGORIES` (`search.js`). Do **not** add it to a new one; see the Archive note under Group-level attributes.
4. Run `make check` and stage the regenerated `docs/icon-sheet.html`, the sheet groups icons by section and accent, so moving a card changes it.

Everything else follows from `data-status="archived"`: the counts, the rail, the badge, the palette chip and the terminal all read the attribute.

### Analytics (kit-owned, do not add per-page tags)

Removed 2026-08-20: the per-page Plausible and Google Analytics tags this section
used to require. Analytics now lives in the vendored Header Kit
(`js/neorgon-header.js`, canonical `packages/neorgon-ui/header/header.js`):
GoatCounter (pageviews + share-arrival events) and Cloudflare Web Analytics
(pageview baseline), both inert until the two constants at the top of the
canonical kit file are set. Do not add analytics script tags to any page; when
the beacons are enabled, the page's CSP needs `https://gc.zgo.at` and
`https://static.cloudflareinsights.com` in `script-src` plus the GoatCounter
endpoint and `https://cloudflareinsights.com` in `connect-src`. Rationale and
rollout: `docs/plans/2026-08-20-agent-ready-platform-plan.md` (W0).
