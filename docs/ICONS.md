# Icon System Reference

## Overview

All Neorgon card icons are stroke drawings on a **24×24 grid**, mostly sourced from
[Lucide](https://lucide.dev/icons) (MIT) and hand-drawn in the same language where no
Lucide icon fits. One weight, one colour, one corner treatment.

The standard is **machine-checked**:

```bash
make check                            # lint + regenerate the sheet; non-zero if either is off
make hooks                            # opt in to the pre-commit check (per-clone, run once)
python3 scripts/icon-lint.py --fix    # rewrite the offenders in place
```

> **`make check` and the hook judge different things, on purpose.** `make check` reads your
> working tree — the right answer while you are drawing. `.githooks/pre-commit` reads the
> **staged snapshot**, because that is what the commit ships. The two disagree in exactly the
> cases that matter: a half-finished icon you have not staged blocks `make check` but not the
> commit, and an `index.html` referencing an icon nobody ran `git add` on passes `make check`
> — the file is right there on disk — while the hook fails it with `MISSING`. `neokeys.svg`
> shipped that way: the card was committed, the icon never was, and neorgon.com served a 404
> for it with the card rendering no mark at all. A tree lint cannot see that; an index lint
> cannot miss it.

> **Why a linter and not just this document.** This file already said 24×24 / stroke 2 /
> `#E326E4` / no fixed `width`/`height`. By August 2026 the set had drifted off all four
> rules: fourteen icons were drawn on a 64-unit canvas, three carried
> `stroke="currentColor"` (which resolves to **black** inside an `<img>` — those icons
> were nearly invisible on a dark card), and several kept a `width="800px"` from
> whichever icon site they were downloaded from. A rule nobody can run is a rule that
> decays silently.

### The number that actually matters

Icons render at a fixed 28×28, so the authored `stroke-width` means nothing on its own.
What the eye sees is:

```
effective stroke = stroke-width / viewBox-size × 28
```

Before the August 2026 sweep that ran from **0.88px** (64-unit canvas at stroke-width 2)
to **2.33px** (the 24-unit majority at stroke-width 2) — a 2.7× spread with no visible
cause, which read as "some of these icons are faint".

## Current Icon Mapping

| Tool | Lucide Icon | File |
|------|-------------|------|
| Skill Roadmap | `network` | skill-roadmap.svg |
| JSON Studio | `braces` | json-builder.svg |
| Client Says | `clock` | client-says.svg |
| Local Drills | `server` | local-drills.svg |
| Decision Wheel | `disc` | spin-the-wheel.svg |
| Reference Matrix | `grid-3x3` | reference-matrix.svg |
| Presentation Sage | `presentation` | presentation-sage.svg |
| Pathfinder | `compass` | pathfinder.svg |
| Emoji Archive | `smile` | emojis.svg |
| Meme Vault | `image` | memes.svg |
| Vibe Check | `clipboard-check` | interviews.svg |
| OG Studio | `palette` | og-studio.svg |
| Autopilot | `bot` | autopilot.svg |
| Character Sheet | `user-circle` | character-sheet.svg |
| BuyHacks | `shopping-cart` | buyhacks.svg |
| Snippets | `code-2` | snippets.svg |
| Guild Hall | `shield` | guild-hub.svg |
| Parla | `languages` | parla.svg |
| Playbook | `book-open` | playbook.svg |
| Rush Q Cards | `layers` | rush-q-cards.svg |
| Agent Lore | `sparkles` | agentlore.svg |

## Adding a New Icon

### 1. Find a Lucide Icon

Browse the icon library at **[lucide.dev](https://lucide.dev/icons)**

Search by keyword (e.g., "code", "database", "chart") to find an icon that represents your tool.

### 2. Get the SVG Code

On lucide.dev, click the icon you want, then click "Copy SVG". You'll get something like:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths here -->
</svg>
```

### 3. Customize with Brand Color

Replace `stroke="currentColor"` with `stroke="#E326E4"` (Neorgon brand purple/pink).

**Example:**

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E326E4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <path d="M12 8v8"/>
  <path d="M8 12h8"/>
</svg>
```

### 4. Save the File

Save to `assets/icons/{tool-name}.svg` using kebab-case naming:
- `skill-roadmap.svg`
- `json-builder.svg`
- `new-tool-name.svg`

### 5. Add to HTML

In `index.html`, add a new card with your icon:

```html
<div class="site-card" data-card-id="new-tool" style="--card-glow: #34d399; --card-accent: #34d399;">
  <div class="card-icon-wrap">
    <img src="assets/icons/new-tool.svg" alt="New Tool" class="card-site-icon">
  </div>
  <div class="card-content">
    <div class="card-header">
      <div class="card-name">New Tool</div>
      <a href="https://newtool.neorgon.com/" class="card-domain">newtool.neorgon.com</a>
    </div>
    <div class="card-desc">Description of your new tool</div>
    <div class="card-tags">
      <span class="card-tag">tag1</span>
      <span class="card-tag">tag2</span>
    </div>
  </div>
  <div class="card-arrow">→</div>
</div>
```

### 6. Register for Search

In `js/search.js`, add your card ID to the appropriate category:

```javascript
const CATEGORIES = [
  { label: 'DevOps', color: '#fbbf24',
    ids: ['cardforge', 'infradrills', 'snippets', 'new-tool'],   // Add here
    keywords: '… plus any words someone might search for' },
  // ...
];
```

`ids` must match the `.card-group` the card actually sits in — a pill whose ids point at
a section that does not hold them filters the catalog to nothing.

### 7. Add Preview GIF

In `js/previews.js`, add a GIF preview:

```javascript
const PREVIEW_MAP = {
  // ...
  'new-tool': 'assets/previews/new-tool.gif'
};
```

Place the GIF in `assets/previews/`.

## Icon Selection Guidelines

Choose icons that:
- **Clearly represent the tool's function** (e.g., `clock` for timezone tools, `shield` for security)
- **Match the semantic domain** (e.g., `code-2` for developer tools, `palette` for design)
- **Avoid visual overlap** with existing icons (check current mapping above)

### Common Icon Categories

| Category | Recommended Icons |
|----------|------------------|
| **Code/Dev** | `code`, `code-2`, `terminal`, `brackets`, `braces` |
| **Data** | `database`, `table`, `file-json`, `binary` |
| **Communication** | `message-circle`, `languages`, `mail`, `phone` |
| **Time** | `clock`, `calendar`, `timer`, `history` |
| **Visual** | `image`, `palette`, `eye`, `camera` |
| **Navigation** | `compass`, `map`, `route`, `signpost` |
| **Organization** | `grid-3x3`, `layers`, `columns`, `folder` |
| **Identity** | `user`, `user-circle`, `users`, `shield` |
| **Interaction** | `mouse-pointer-click`, `touch-app`, `hand` |
| **Intelligence** | `brain`, `sparkles`, `bot`, `zap` |

## Colour: the file says magenta, the card decides

Card icons are rendered as **masks**, not images:

```html
<span class="card-site-icon" aria-hidden="true"
      style="--icon: url('/assets/icons/pathfinder.svg')"></span>
```

```css
span.card-site-icon {
  background-color: var(--card-accent, #E326E4);
  mask-image: var(--icon);          /* plus -webkit- and the size/repeat/position longhands */
}
```

The SVG supplies the **shape**; the element supplies the **colour**, from the card's own
`--card-accent`. Every other coloured thing on a card (tags, domain line, Soon badge, New
badge) already worked this way; the icon was the last holdout.

Three consequences worth knowing:

- **The path in `--icon` must be root-relative** (`/assets/icons/x.svg`). A relative `url()`
  inside a custom property resolves against the stylesheet that *substitutes* the `var()`,
  not the HTML that declared it, so `assets/icons/x.svg` becomes `/css/assets/icons/x.svg`
  and every mask 404s silently, leaving invisible icons. Do not "tidy" these back.
- **Only alpha survives.** A mask reads shape, not colour, so a part drawn at `opacity=".45"`
  masks to 45% of the accent. That is how the de-emphasised halves of `carnet.svg` and
  `minimap.svg` still read as secondary.
- **Icons are `aria-hidden`.** They repeat the card's own name, so labelling them made a
  link announce "Pathfinder, pathfinder.neorgon.com, Pathfinder".

**Primary icon color:** `#E326E4`, written literally into every file and enforced by the
linter. Under a mask only alpha matters, so this looks like dead metadata — it is not. It is
what the no-mask-support fallback paints (`@supports not (mask-image: …)` draws the same file
as an ordinary `background-image`), and what you see opening the file on its own.

Never `currentColor`. It is right for an inlined SVG and completely wrong here: an `<img>`
loads the file as its own document with no access to the host page's colour, so
`currentColor` resolves to black.

**Exceptions that stay `<img>`:** the four third-party brand marks, and `energon-logo.png`
(a raster file has no shape to mask). Recolouring someone else's trademark to match a card is
not consistency. `icon-lint.py` enforces this in both directions — an exempt mark rendered as
a masked `<span>`, or one of ours rendered as a plain `<img>`, both fail.

## Technical Details

| Property | Value | Enforced by |
|---|---|---|
| viewBox | `0 0 24 24` | convention |
| stroke-width | **2.2** | `icon-lint.py` |
| stroke | `#E326E4` | `icon-lint.py` |
| stroke-linecap / linejoin | `round` | `icon-lint.py` |
| fill | `none` (stroke drawings) | convention |
| root `width` / `height` | **absent** — CSS owns the box | `icon-lint.py` |
| rendered as | masked `<span>` taking `--card-accent` | `icon-lint.py` |
| rendered size | 28×28 inside a 42×42 wrapper | `css/style.css` |

**Why 2.2 and not Lucide's stock 2.** 2.2/24 lands at ~2.55px effective at the 28px render
size, against 2.33px for stock Lucide. A deliberate step up: at 28px on a dark tile a 2px-grid
stroke reads thin. `icon-lint.py` derives it as `viewBox / 11`, so an icon on another canvas
still lands on the same effective weight.

## Hand-drawn icons

Not every tool has a Lucide equivalent. The constraint that matters is 28px, not the 24-unit
canvas you draw on: **three shapes is the budget**, and detail under ~1.5 units disappears.
Two rules learned the hard way:

- **A shape's silhouette outranks its parts.** Doorman was a doorman's cap above a door. A
  wide brim on a narrower rounded body is, unmistakably, a *trash can*. It is an archway now.
- **Simplifying can collide with a neighbour.** UI Anatomy reduced to "rectangle plus text
  lines", which is what Incident Runbook and Hiring Pack already looked like. A header bar and
  a sidebar split says *wireframe* and nothing else does.

Check a new icon against the whole set at 28px before committing, not on its own:

```bash
python3 scripts/icon-sheet.py     # writes docs/icon-sheet.html
```

That sheet renders every card icon at 60px and 28px in its own card's colour. Scan it for
exactly two things: a silhouette that reads as the wrong object, and two icons that read as
each other. Both defects it has already caught were invisible file-by-file.

## Resources

- **Lucide Icon Library:** https://lucide.dev/icons
- **Lucide GitHub:** https://github.com/lucide-icons/lucide
- **License:** MIT (free for commercial use)

## Troubleshooting

### Icon looks too thick, too thin, or the wrong colour
Run `make check`. It names the file and the exact rule broken.

### Icon renders black / barely visible
`stroke="currentColor"`. Inside an `<img>` there is no inherited colour to take.
`--fix` rewrites it to `#E326E4`.

### Icon renders as a solid coloured square, or not at all
The mask is failing. Check the `--icon` path is root-relative.

### Icon looks pixelated or the wrong size
A root `width`/`height` attribute is fighting the CSS box. `--fix` strips it.

### Icon isn't showing
- Check the file path in HTML matches the filename exactly (case-sensitive)
- Verify the SVG file is valid XML (properly closed tags)
- Check browser console for 404 errors

## Quick Reference Command

To create a new icon file from scratch:

```bash
cd assets/icons
cat > new-tool-name.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E326E4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Paste Lucide icon paths here -->
</svg>
EOF
```

## Alternative: Using Lucide React/CDN

If you prefer loading icons dynamically instead of individual SVG files:

```html
<!-- In head -->
<script src="https://unpkg.com/lucide@latest"></script>

<!-- In HTML -->
<i data-lucide="icon-name" style="color: #E326E4; width: 28px; height: 28px;"></i>

<!-- Initialize -->
<script>
  lucide.createIcons();
</script>
```

This approach loads icons on-the-fly but requires JavaScript and an external CDN. The current system (individual SVG files) is preferred for performance and offline support.
