# Icon System Reference

## Overview

All Neorgon site icons use the **Lucide icon system** for visual consistency. Lucide provides:
- Unified stroke-based design (24×24 grid, 2px stroke weight)
- Perfect compatibility with neon glow effects
- 1000+ icons in the same style
- MIT license

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
const CATEGORIES = {
  development: ['local-drills', 'json-builder', 'snippets', 'new-tool'], // Add here
  // ...
};
```

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

## Brand Color

**Primary icon color:** `#E326E4` (neon purple/pink)

This color is applied in the CSS with `filter: drop-shadow(0 0 5px rgba(255,255,255,.5))` for the neon glow effect.

## Technical Details

- **Viewbox:** `0 0 24 24` (standard)
- **Stroke weight:** `2` (consistent across all icons)
- **Stroke caps:** `round`
- **Stroke joins:** `round`
- **Fill:** `none` (stroke-based design)
- **Size in HTML:** Icons are sized by CSS to `28px × 28px` inside a `44px × 44px` wrapper

## Resources

- **Lucide Icon Library:** https://lucide.dev/icons
- **Lucide GitHub:** https://github.com/lucide-icons/lucide
- **License:** MIT (free for commercial use)

## Troubleshooting

### Icon looks too thick
Check that `stroke-width="2"` (not 3 or 4)

### Icon doesn't glow
Verify the stroke color is `#E326E4` and CSS applies `filter: drop-shadow()`

### Icon looks pixelated
Ensure the SVG has `viewBox="0 0 24 24"` and no fixed `width`/`height` attributes (or set to "24")

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
