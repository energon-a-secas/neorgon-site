# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make serve          # Start local dev server on port 8800 (opens http://localhost:8800)
make stop           # Kill the dev server
make check          # Preview map + icon standard: lint, regenerate docs/icon-sheet.html, non-zero if off
make hooks          # Opt in to the pre-commit icon check (per-clone, run once)

npx convex dev      # Run Convex backend (required for terminal auth features)
```

Card icons are masked `<span>`s that take their card's `--card-accent`; the four third-party
brand marks stay `<img>`. `scripts/icon-lint.py` enforces both the file rules and which of
the two an icon uses. Details and reasoning: `docs/ICONS.md`.

`scripts/preview-lint.py` runs first and reconciles `PREVIEW_MAP` in `js/previews.js`
against `assets/previews/`. **Two hard fails.** A map entry naming a missing file (DEAD),
because that preview dies through `img.onerror` with nothing logged: three had, one of them
on a live card. And a GIF whose aspect no card box can show (SHAPE): a card box is 358px by
233..285, an aspect of 1.26..1.53, and `.card-preview img` is `object-fit: cover`, so an
off-shape preview is not blank, it silently shows a cropped two thirds of itself. Every
preview in the fleet was 646x300 (aspect 2.153) until 2026-09-18 and every one was displayed
wrong. SHAPE is checked on **aspect, not exact pixels**, on purpose: the output size belongs
to the recorder, and copying it here would give the format two owners. An orphan GIF, a
card with no entry (GAP) and a one-frame GIF (STILL) stay counts rather than failures, since
a permanently red check gets ignored and a card without a preview degrades to a card.

`scripts/count-lint.py` runs next and is the guard on **the tool count's five owners**. The
hero sentence computes its number from the catalog, so the copy a visitor reads cannot go
stale. The meta `description`, the OpenGraph and Twitter descriptions and the JSON-LD
`description` all hardcode it and are read by crawlers before any script runs, so they are
the copies that do. That is not hypothetical: commit `0db8374`, "tool count is 63, Carnet and
Rewind shipped", exists because two cards shipped and those four kept saying 61 while the
hero said 63, and nothing reported it, because the page looks correct in a browser precisely
where it is wrong everywhere else. The check reproduces the inline script's selector as a
regex, which is the only way to compare a CSS selector against a file, and is why it refuses
to pass on fewer than 40 live cards rather than agreeing with itself about zero.

**STILL is the count worth watching**, and it stands at 15 of 63. Those files are valid, the
right shape and the right size, and they show a motionless screenshot: the recorder's default
profile scrolls, and a page that fits one viewport hands it nothing to record. The recorder
does say so per card, but that line scrolls off a 64-card batch log, which is how a quarter of
the fleet's previews came to be stills with nobody counting them. The fix is a scenario per
card, not a re-record.

The previews themselves are **generated, not hand-made**. Canonical recorder:
`../og-studio-site/scripts/record-gif.mjs`, whose format (646x462) is derived from these card
boxes. `make gifs-all` in that repo re-records every live card, `make gifs` fills only the
gaps. A page the generic clip records badly gets `og-studio-site/scenarios/<card-id>.json`,
which is how hand-tuning survives the next batch; five cards have one today and the 15 STILL
cards are the queue for the next. Do not hand-optimise a GIF in this repo, it will be
overwritten by the next run. Two cards are excluded from the recorder on purpose and always
will be: `bouquin` (its GitHub Pages certificate was never provisioned, so the load fails on
`ERR_CERT_COMMON_NAME_INVALID`) and `chasqui` (parked, its card links to the repo because the
subdomain was never created, and the recorder keys off the displayed domain, so that display
string has to keep agreeing with the href or the batch acquires a card that can only fail).

No build step: open `index.html` directly or serve via `make serve`. ES modules are not used here; all scripts are plain `<script>` tags loaded in `index.html`.

## Architecture

Single-page hub at `neorgon.com` listing all Neorgon tools. The page is a single `index.html` (~1,600 lines) with separate JS modules in `js/` and styles in `css/style.css`.

### JS modules (all IIFEs or direct DOM manipulation, not ES modules)

| File | Purpose |
|------|---------|
| `starfield.js` | Animated canvas starfield (200 stars): default background |
| `matrix.js` | Matrix rain canvas: alternate background mode |
| `intervention.js` | "Death Note L" CRT broadcast takeover: third background mode |
| `settings.js` | Settings panel: toggles for sound/glow/previews, background picker. Persists to `localStorage` under key `neorgon-prefs`. **It is the owner of the pref flags, so it publishes them before bailing**, on both early-return paths, since a consumer whose toggle element is missing still has to read the visitor's choice |
| `search.js` | Hero search bar with floating category pills (physics simulation on canvas), **ranked** card filtering, and the route map drawn between pills. Also arrow-key walking + Enter-to-open over the results. `CATEGORIES` must stay 1:1 with the `.card-group` sections in `index.html`. A pill whose `ids` name no group silently filters to zero results. **Ranking:** `scoreCard`/`rank` give every match a score (name-exact 1000 → loose 120) and `syncCatalogMerge` appends in that order, so the merged grid *is* the ranking; ship date breaks ties, newest first. A category's `keywords` blob is a **fallback vocabulary**, not an amplifier. It only expands a group when the query matched no card directly (`cheatsheet` may mean DevOps; `parla` may not mean all of Social). A category *label* always expands, because that is the pill-click path. **Pills stay up during a search:** matched ones travel to the middle and light their routes, the rest recede to 16% and hover back to full. `paintPillStates()` is called from `doFilter`, not only from the rAF loop, so the states still read under `prefers-reduced-motion` where the loop stops after one frame. Receded pills stay in the tab order, so `:focus-visible` restores them alongside `:hover`, and each pill carries **`aria-pressed`** (its label IS the query, which is what a second click undoes) because a toggle announced only in colour and scale is twelve identical buttons to a screen reader. **The cascade is ordered by how deliberate a match is, not by which field it landed in**: `tagWord` (600, a word-start hit on a tag, somebody declared the subject) sits above `nameLoose` (560, `indexOf` on the name, often a coincidence), which is what stopped the query `book` returning Incident Runbook and Playbook above Bouquin. It stays below `nameWord`, since a tool whose name starts with the word is still the better answer. **It also stamps `data-home-group`** on every catalog card at load, because this file is the only one that moves a card out of its category and so the only one that can say where it belongs |
| `recent.js` | "Recently shipped" rail above the catalog. Reads `data-added="YYYY-MM-DD"` off each card, renders the newest 6 as clones, and stamps a self-expiring `New` badge (30 days) on the canonical card. A `.card-group` carrying **`data-recent="off"`** is skipped by **both** recency surfaces, the rail and the badge, because one candidate list feeds both. Applied to **UI Lab**: those are reference tools, and a visitor scanning for what changed should not be handed a wireframe glossary as news. Group-level rather than per-card so the next reference category needs an attribute, not an edit. Archived cards are skipped too. Also owns the shelf-overflow observer that toggles `.is-scrollable` on **both** shelf grids, and the rAF-gated scroll listeners that toggle `.is-scrolled` (the desktop breakout's leading fade and lit column edge). The trailing mask fade must not appear over a row that already fits, and the leading fade must not appear at rest. Exposes `window._neoRecent` for the terminal's `new`, and **`window._neoMakeEcho(card)`**. The one definition of a safe clone (retag `data-card-id` → `data-echo-id`, clear entrance.js's inline delay, convert a multi-tool card to a link). Any shelf that clones catalog cards must use it |
| `favorites.js` | "Your favorites" shelf above the rail, from `localStorage` key `neorgon-favorites` (`[{ id, pinned }]`; a bare id array is the v1 shape and still loads). Injects the control strip into every catalog card and every echo, prunes saved ids whose card no longer exists (and persists the prune), and renders the shelf with `_neoMakeEcho`. Pin holds the front; drag and ArrowLeft/ArrowRight reorder within a band. Exposes `window._neoFavorites` for the terminal's `fav` / `favs` / `pin`. **Never touches the catalog**. The categories below are byte-for-byte what a first-time visitor sees |
| `catnav.js` | Sticky category rail with live counts and scroll-spy. Owns the sticky-chrome offset for the whole page: sets `--cat-rail-top` and every group's `scroll-margin-top` from one measurement, which `terminal.js` `open <cat>` relies on |
| `collapse.js` | Collapsible `.card-group` sections. A group carrying `data-collapsed="true"` ships closed and grows a toggle on its own heading. Applied to **Archive** and **Platforms**. The shipped default lives in the HTML; the visitor's choice overrides it in `localStorage` key `neorgon-collapsed`, which stores **only deviations from the default**, so changing a group's shipped default later still reaches everyone who never touched it. Loads **after `catnav.js`** on purpose: catnav builds its chip labels from `.group-label` `textContent`, and this module reparents that heading into a `<button>`. For the same reason the card count is generated content off `data-count` and the chevron is an SVG, neither of which `textContent` can see. Put a text node in that heading and every category chip gains a stray "1 tool". Exposes `window._neoCollapse` |
| `tags.js` | Tag rows: one line at rest, the rest behind a `+N` chip, and **clicking a tag searches it**. The clipping is **visual only**, `overflow: hidden` on a `max-height` of one tag, never `display: none`, so search.js still indexes every tag and a screen reader still reads every tag. That is what makes the chip safe to keep `aria-hidden` and out of the tab order (the `.card-arrow` precedent): it reveals nothing assistive tech could not already read, so 74 extra tab stops would buy no new ability. **Which tags are hidden is measured, never authored**, since the answer depends on rendered word widths and viewport. Each row is measured **twice, ungutttered first**: reserving the 46px chip gutter before measuring makes the chip the cause of the overflow it then reports, which clipped 16 of 73 rows, 14 of them rows that had been showing everything. Overflow with no chip is the only thing that earns a chip. Re-measures on `resize` and on a `MutationObserver` over `#tools`, which is what catches search.js reparenting cards into `#catalogSearchMerged`. Loads **after `favorites.js`**: a saved card's control strip claims the same corner, and the gutter measured has to be the one actually reserved (`--tag-strip-w`). Exposes `window._neoTags` |
| `palette.js` | ⌘K / Ctrl+K command palette over every tool (fuzzy match, recency tie-break). Shows an `Archived` chip alongside the existing `Soon` chip |
| `cards.js` | Multi-tool card popup (for cards with sub-tools) and ghost card unlock logic |
| `previews.js` | GIF previews on card hover after 1.2s delay: enabled only when `window._neoPreviewsEnabled` is true. **It claims that flag only if nobody else has**, `if (window._neoPreviewsEnabled === undefined)`. settings.js loads first and has already published the visitor's saved pref by the time this file runs, so a plain assignment overwrote it: the toggle rendered on, `aria-pressed="true"`, and the feature was off with nothing on screen to explain why. Swapping the two `<script>` tags was rejected as the fix, since it leaves correctness resting on the order of two lines 1,900 away from the code that cares; a guard cannot be undone by a reorder. Keyed to `.site-card[data-card-id]`, so shelf echoes never preview |
| `sortable.js` | Per-group card drag-reorder using SortableJS CDN. `window.exportCardOrder()` / `window.importCardOrder()` helpers available in console |
| `music.js` | YouTube IFrame ambient music synced to background mode (stars/matrix/intervention). A `pageshow` handler covers bfcache restores: heap and DOM thaw with `playing` still true but iframe audio stays paused, so it attempts a resume through the same mute-then-unmute path a click uses and drops to an honest off state (class, `aria-pressed`, spin) when the player is not audibly going ~1.2s later |
| `sound.js` | UI sound effects: exposes `window._neoSound` with `.dragStart()`, `.dropCard()`, `.unlock()`, and `window._neoSoundPing(freq, vol)`, `window._neoSoundDiscover()` |
| `cursor.js` | Custom cursor glow element |
| `entrance.js` | Card entrance stagger. Delays are **per group and capped** (8 × 55ms), not a global `index × 110ms` timeline. The old form grew with the catalog (5.4s at 50 cards) and leaked into the rail, because recent.js clones these cards and `cloneNode` copies the inline `animation-delay`. recent.js now clears that on every echo; do not reintroduce a global counter here |
| `hero.js` | Hero typewriter (one of four completions for "Made to fit ___", picked per load), the rotating badge, and the scroll cue. The chevron pair under the constellation. The cue retires permanently on the first scroll of any size and never returns |
| `terminal.js` | Hidden terminal (keyboard shortcut) with Convex auth for admin commands. Opens on an **ASCII login banner** printed once per page load (`banner` / `motd` reprints it; `clear` is allowed to mean clear). The banner reports the live catalog, so it cannot be written into `index.html`. Two wordmarks: the block form is 66 columns and the body is `white-space: pre-wrap` inside a `min(640px, 90vw)` box, so `termColumns()` **measures** the body with a probe span in its own font rather than assuming a character width, and falls back to 80 columns when the body has no layout yet. Get that fallback wrong and a desktop silently gets the phone banner. Stat rows hang-indent to the value column, derived from the same leader width they are printed with. Navigation/discovery commands (`tools`, `goto`, `open`, `whois`, `new`, `stats`, `random`, `search`) build their catalog from the DOM, so a new card needs no terminal edit. **`catalog()` reads `data-home-group`, never `closest('.card-group')`**: search.js reparents matched cards into `#catalogSearchMerged`, so the parent-based form made `whois` print `category  Matches` for any tool the visitor had searched for. The `closest()` form survives only as the fallback for cards outside the catalog, which is where the ghosts live. Two logins, see below. `theme` sets the *visitor's* cookie via `NeoHeader.setTheme` only, changing the fleet-wide CDN default belongs in an ops console, not a page anyone can open |
| `codes.js` | Easter eggs: Konami code (warp drive), other sequences |
| `secret.js` | Proximity sonar scanner revealing a hidden section |
| `evangelion.js` | Fourth background mode, a canvas. `window.evangelionOn/Off/Kill` |
| `egg.js` | Fifth background mode, a YouTube video behind `#eggBackground`. `window.eggOn/Off/Kill` |
| `interference.js` | Receiving half of the terminal's admin `interfere`: watches one Convex row over a **WebSocket** and lands a forced theme under a burst of static. Owns a second Convex client on purpose (the terminal's `ConvexHttpClient` cannot subscribe). **Every visitor pays for it**: a receiver has to be listening, so a fresh load with the terminal never opened still issues 15 cross-origin requests to esm.sh and opens a socket. Deferred to idle with a `setTimeout` floor, because `requestIdleCallback` never fires in the background tab that is this feature's normal case. Sits *below* the visitor in the header kit's precedence, so `?theme=` survives the burst |
| `dispatch-popup.js` | Native Antenne desktop bulletin (styles in `css/dispatch-popup.css`). Fetches the fleet feed after idle, validates and renders the newest three stories, and reuses local catalog icons with launch/feature/fix/note badges. Dismissal stores a versioned list of story IDs and dates in `neorgon-dispatch-seen`, so another story on the same day reopens the bulletin. Legacy date-only values reopen once. The dock reopens it; close/Escape returns focus. No iframe or remote favicon fetch. The localhost feed is `localhost:8873/data/posts.json`; an unavailable feed is caught and leaves the catalog usable. |

Not in this table because they are **vendored kit files**: `neorgon-header.js`,
`neorgon-footer.js`, `neorgon-auth.js`, `neorgon-auth-sites.js`. Never edit them here;
edit `packages/neorgon-ui/` and re-run that kit's sync script.

### Global window flags (cross-module communication)

- `window._neoSoundEnabled`: boolean, set by settings.js
- `window._neoPreviewsEnabled`: boolean, set by settings.js
- `window._neoSound`: sound effect object from sound.js
- `window._neoSoundPing(freq, vol)`: from sound.js
- `window._neoSoundDiscover()`: from sound.js
- `window._neoMakeEcho(card)`: from recent.js, the safe-clone helper both shelves use
- `window._neoFavorites`: from favorites.js: `{ list(), has(id), isPinned(id), toggle(id), pin(id), clear() }`. `toggle` and `pin` return `true` on / `false` off / **`null` when the id names nothing in the catalog**, three outcomes, because `false` for both "removed" and "not a tool" is how a caller reports a removal that never happened. `pin` on an unsaved tool saves it in the same gesture
- `window._neoTags`: from tags.js: `{ refresh(), state(cardId) }`. `state` returns what the row decided (`{ tags, clipped, hidden, open }`) so a check can assert the outcome without reimplementing the measurement, which is the only way to test a layout that depends on rendered text width
- `window._neoCollapse`: from collapse.js: `{ expand(groupId), isOpen(groupId) }`. `expand` opens a collapsed group and returns whether it knew the id. Used by `terminal.js` `open <cat>` so a jump never lands on a heading with nothing under it. Chip clicks and fragment jumps are handled inside collapse.js itself
- `window._neoMusicSwitch(mode)`: from music.js, called by settings.js when background changes
- `window._neoBgSync(mode)`: from settings.js, called by terminal.js to sync picker state
- `window.matrixOn/Off/Kill`, `window.interventionOn/Off/Kill`, `window.evangelionOn/Off/Kill`, `window.eggOn/Off/Kill`: background control from the four non-default background modules. settings.js calls `Off` on the outgoing mode when switching to `stars` and `Kill` on all four otherwise
- `window._neoFresh30`: from recent.js, the count of tools shipped inside the 30-day window. **The one owner of that number.** It had four implementations and two answers: the hero inline script said 17, the rail said 16, and the terminal's banner and `stats` said 17 again. The two causes were invisible to a reader, one copy had no notion of `data-recent="off"` and compared ISO strings against a local-clock cutoff while recent.js does fractional-UTC-day arithmetic. `freshCount` is the number a visitor can audit, because it is the number of `New` badges the same loop stamped. terminal.js prefers this and falls back to counting for itself

### Convex backend

Two consumers, two clients, deliberately unconnected. Schema in `convex/schema.ts`:
- `users` table: `username`, `passwordHash` (indexed by username)
- `loginAttempts` table: rate-limit tracking per identifier
- the `interference` row that `interfere` writes and `interference.js` watches

Convex URL: `https://quaint-cobra-151.convex.cloud`.

`terminal.js` lazy-loads `ConvexHttpClient` from `esm.sh` **only when the terminal is
opened**, for the admin `login`. `interference.js` loads the WebSocket `ConvexClient`
**on every page load** so it can subscribe, which is why "Convex is only fetched when
the terminal opens" is false and was false from the day that module shipped. Measured on
a fresh load with the terminal never opened: 15 requests to esm.sh, one open socket.

### The two logins in the terminal

They grant different things and are not linked. Getting this wrong is a privilege
escalation, so it is stated rather than implied:

| Command | Account | Grants |
|---|---|---|
| `signin` / `signout` / `sites` | the visitor's **Clerk** account, via the Neorgon Auth Kit | identity only. `whoami` reports it, `sites` lists their Neorgon sites |
| `login <u> <p>` / `logout` | the Convex `users` table | the admin commands: `ghost`, `broadcast`, `interfere` |

**A Clerk session must never satisfy the `authCommands` gate.** Clerk sign-up is open
across the fleet, so anyone who can register an email would inherit `interfere`. The
`users` table has no Clerk-id column and inventing one is not a login command's job.
`whoami` reports both identities and is `async` for that reason.

The Auth Kit is adopted here (`css/neorgon-auth.css`, `js/neorgon-auth.js`,
`js/neorgon-auth-sites.js`, vendored by `packages/neorgon-ui/sync-auth.sh`) with **no
`.neo-auth` header slot on purpose**: the terminal is the hub's only account-gated
surface, so a "Sign in" button on the fleet's front door would be an affordance leading
nowhere. Putting it back is one documented line of HTML, noted beside the kit's head
block in `index.html`. The apex hub is excluded from the generated catalogue because
`authkit.py site_id()` requires a `<sub>.neorgon.com` host, so adopting it here triggers
no fleet-wide regeneration. A production Clerk key **refuses localhost by design**, so
completing a sign-in cannot be exercised locally; the kit warns and says why.

### Card data model

Each tool card in HTML has:
- `data-card-id`: unique slug matching `PREVIEW_MAP` in previews.js and `CATEGORIES` in search.js
- `data-added="YYYY-MM-DD"`: the day it shipped. Drives the Recently shipped rail and the self-expiring `New` badge (recent.js); no separate list to maintain
- `data-status="soon"`: the tool's subdomain is reserved but serves nothing yet. The card is a `<div class="site-card soon-card">` with a `.soon-badge` where the arrow goes, **no `href`** (so it cannot navigate to a 404) and **no `data-added`** (nothing shipped). One attribute, read by every module that counts or navigates: the hero count and the search denominator skip it, the rail and the `New` badge skip it, palette.js shows a Soon chip and scrolls to the card instead of opening it, terminal.js keeps it out of `liveTools()` and has `goto` report the state. Search still finds it, and the search line reads `N of M tools · 1 coming soon`. To ship it: `<div>` → `<a href>`, badge → `.card-arrow`, drop `data-status`, add `data-added`
- `data-status="archived"`: the tool still works and the domain is still up, but it is no longer what we would point someone at. The third card state, after live and Soon, and it fails the *opposite* way: a Soon card cannot be opened, an archived card can. It keeps its `href`, its arrow and its `data-added`, and gains an `.archived-badge`, a `.card-superseded` line naming what replaced it, a dashed border, a desaturated icon and a resting dim. It leaves every count that means a recommendation (the hero count, the search denominator, `stats`, `random`, `liveTools()`, the rail and the `New` badge) and stays fully findable: search scores it by name, `goto` and `whois` resolve it, the palette shows an `Archived` chip. The search line gets its own `N archived` segment for the same reason `soon` and `external` have one, a query that puts a card on screen must never report zero. Archived cards live in the **Archive** group at the foot of the catalog. Styling selectors are `.site-card.archived-card`, **not** `.archived-card`: that block sits above `.site-card` in `style.css` and at equal specificity the later rule wins. **The resting dim goes on `.card-content`, never on the card**, via `--card-rest-dim` (`.72` archived, `.78` Soon). Every catalog card runs `cardEnter` with `forwards`, and a filling animation's `to { opacity: 1 }` outranks a normal declaration on the same element, so `opacity` set on `.site-card` is inert. `.soon-card { opacity: .78 }` shipped dead for as long as Soon cards existed, and the hover rule that "restored" it was restoring nothing
- `.card-name`, `.card-desc`, `.card-domain`, `.card-tag`: searchable text fields
- `--card-glow` / `--card-accent` CSS custom properties: per-card neon colour

`data-card-id` is the join key across search.js, previews.js, cards.js and sortable.js. The rail's clones therefore carry **`data-echo-id`** instead, same value, different attribute, which is what keeps a cloned card out of the search index, the drag-reorder, and the "N of M tools" count. Anything that walks cards should either scope itself to `#tools` or filter out `.site-card--echo`.

`data-home-group` is the other cross-module attribute, stamped on every catalog card by
search.js at load and holding the `id` of the `.card-group` the card belongs to. **Ask it,
not the DOM tree, for a card's category.** While a search is active every matched card has
been reparented into `#catalogSearchMerged`, so `closest('.card-group')` answers "Matches"
for all of them, which is how the terminal's `whois` came to report a Social tool as
`category  Matches`.

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
`bg` values: `"stars"` | `"matrix"` | `"intervention"` | `"evangelion"` | `"egg"`

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
3. Record its preview: `cd ../og-studio-site && node scripts/record-gif.mjs <card-id> --light --deploy`. That writes `assets/previews/<card>.gif` at the card-box format and adds the `PREVIEW_MAP` entry itself, so neither is a manual step. Then `make check` to confirm.
4. Register the new icon file in `assets/icons/`.

Tags are the strongest signal search.js has (a word-start hit on a tag outranks a loose name
match), so give a card as many as it genuinely deserves: `tags.js` shows one line and hides
the rest behind `+N`, and the hidden ones are still indexed and still read aloud. Prefer an
existing tag over a near-synonym, and keep them plural-consistent with what is already there.
A `Game`/`Games` split is two tags for one subject and it dilutes both; seven such pairs were
merged on 2026-09-18, and a check for the remaining ones is a normalise-and-bucket over
`.card-tag` text.

The rail, category chips, palette and terminal all read the DOM, so they pick the card up with no further edits, and so does the hero's `#toolCount`.

**The four static descriptions do not.** The meta `description`, the OpenGraph and Twitter
descriptions and the JSON-LD `description` each spell the count out, because a crawler reads
them before any script runs. Update all four, plus the `#toolCount` fallback literal, in the
same edit as the card. `make check` fails naming the line and the right number if you don't,
which is the only reason this is a chore rather than a bug: the number a visitor sees is
computed, so a browser cannot show you that the other four are wrong.

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
