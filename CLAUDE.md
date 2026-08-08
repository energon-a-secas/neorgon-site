# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make serve          # Start local dev server on port 8877 (opens http://localhost:8877)
make stop           # Kill the dev server

npx convex dev      # Run Convex backend (required for terminal auth features)
```

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
| `search.js` | Hero search bar with floating category pills (physics simulation on canvas), card filtering, and constellation drawing connecting matched cards. Also arrow-key walking + Enter-to-open over the results. `CATEGORIES` must stay 1:1 with the `.card-group` sections in `index.html` — a pill whose `ids` name no group silently filters to zero results |
| `recent.js` | "Recently shipped" rail above the catalog. Reads `data-added="YYYY-MM-DD"` off each card, renders the newest 6 as clones, and stamps a self-expiring `New` badge (30 days) on the canonical card. Exposes `window._neoRecent` for the terminal's `new` |
| `catnav.js` | Sticky category rail with live counts and scroll-spy. Owns the sticky-chrome offset for the whole page: sets `--cat-rail-top` and every group's `scroll-margin-top` from one measurement, which `terminal.js` `open <cat>` relies on |
| `palette.js` | ⌘K / Ctrl+K command palette over every tool (fuzzy match, recency tie-break) |
| `cards.js` | Multi-tool card popup (for cards with sub-tools) and ghost card unlock logic |
| `previews.js` | GIF previews on card hover after 1.2s delay — enabled only when `window._neoPreviewsEnabled` is true |
| `sortable.js` | Per-group card drag-reorder using SortableJS CDN. `window.exportCardOrder()` / `window.importCardOrder()` helpers available in console |
| `music.js` | Web Audio API ambient music synced to background mode (stars/matrix/intervention) |
| `sound.js` | UI sound effects — exposes `window._neoSound` with `.dragStart()`, `.dropCard()`, `.unlock()`, and `window._neoSoundPing(freq, vol)`, `window._neoSoundDiscover()` |
| `cursor.js` | Custom cursor glow element |
| `entrance.js` | Page entrance animation |
| `hero.js` | Hero section typewriter / tagline animation |
| `terminal.js` | Hidden terminal (keyboard shortcut) with Convex auth for admin commands. Navigation/discovery commands (`tools`, `goto`, `open`, `whois`, `new`, `stats`, `random`, `search`) build their catalog from the DOM, so a new card needs no terminal edit. `theme` sets the *visitor's* cookie via `NeoHeader.setTheme` only — changing the fleet-wide CDN default belongs in an ops console, not a page anyone can open |
| `codes.js` | Easter eggs: Konami code (warp drive), other sequences |
| `secret.js` | Proximity sonar scanner revealing a hidden section |

### Global window flags (cross-module communication)

- `window._neoSoundEnabled` — boolean, set by settings.js
- `window._neoPreviewsEnabled` — boolean, set by settings.js
- `window._neoSound` — sound effect object from sound.js
- `window._neoSoundPing(freq, vol)` — from sound.js
- `window._neoSoundDiscover()` — from sound.js
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
- `.card-name`, `.card-desc`, `.card-domain`, `.card-tag` — searchable text fields
- `--card-glow` / `--card-accent` CSS custom properties — per-card neon colour

`data-card-id` is the join key across search.js, previews.js, cards.js and sortable.js. The rail's clones therefore carry **`data-echo-id`** instead — same value, different attribute — which is what keeps a cloned card out of the search index, the drag-reorder, and the "N of M tools" count. Anything that walks cards should either scope itself to `#tools` or filter out `.site-card--echo`.

Multi-tool cards (`.site-card.multi-tool`) show a `.card-subtool-popup` on click. Ghost cards (`.ghost-card`) are locked until clicked, then play an unlock sound.

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
