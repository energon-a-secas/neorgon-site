---
name: Neorgon Hub
description: Deep-space catalog of engineering tools with per-card neon accents and glass-touched surfaces.
colors:
  void-bg: "#000912"
  surface-card: "#000c18"
  surface-preview: "#0a0e1a"
  text-primary: "#f0f4ff"
  text-secondary: "#8fa0c0"
  text-muted: "#8fa0c0a6"
  border-subtle: "#ffffff14"
  border-strong: "#ffffff26"
  glass-fill: "#ffffff0a"
  glass-fill-hover: "#ffffff0f"
  accent-plasma: "#c084fc"
  accent-indigo: "#818cf8"
  accent-fuchsia: "#e879f9"
  focus-ring: "#818cf8"
  skip-link-bg: "#818cf8"
  skip-link-text: "#000000"
typography:
  display:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.2rem, 6vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  title:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  body:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "'Avenir Next', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.12em"
rounded:
  xs: "5px"
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  pill: "20px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "28px"
  section-x: "40px"
  section-bottom: "80px"
  hero-y: "60px"
components:
  hero-badge:
    backgroundColor: "#c084fc1f"
    textColor: "{colors.accent-plasma}"
    rounded: "{rounded.pill}"
    padding: "5px 14px"
  hero-search:
    backgroundColor: "{colors.glass-fill}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "14px 44px"
  hero-search-focus:
    backgroundColor: "{colors.glass-fill-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "14px 44px"
  site-card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
  card-tag:
    backgroundColor: "#818cf814"
    textColor: "{colors.accent-indigo}"
    rounded: "10px"
    padding: "3px 8px"
  skip-link:
    backgroundColor: "{colors.skip-link-bg}"
    textColor: "{colors.skip-link-text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
---

# Design System: Neorgon Hub

## Overview

**Creative North Star: "The Constellation Catalog"**

Neorgon reads as mission control in deep space: a void field, faint grid, slow starfield, and a **constellation of tool cards** where each destination gets its own accent hue (set inline via `--card-accent`, `--card-glow`, `--card-glow-border`). The UI is dark-first not for trend, but for contrast against neon waypoints and long scan sessions.

Density is **catalog-forward**: section rails, uppercase micro-labels, and a responsive auto-fill grid (`minmax(300px, 1fr)`) keep tools scannable. Motion supports discovery (card entrance, hover glow, optional cursor bloom) but defers to `prefers-reduced-motion` for ambient layers. Personality lives in disciplined accents and easter-egg layers, not in burying links under marketing chrome.

This system rejects what PRODUCT.md calls **generic SaaS landing patterns**, **interchangeable AI-wrapper aesthetics**, **dark patterns**, and **trust-center blandness**. Visually that means: no hero-metric stack, no identical icon triptychs as the only content, no fake urgency strips, and no stripping the grid down to gray boxes.

**Key Characteristics:**

- Per-tool **accent injection** through CSS variables on each card; default fallback indigo `#818cf8`.
- **Tonal depth** from true void `#000912` through semi-opaque card shells and soft borders, not from heavy skeuomorphic chrome.
- **Glass touches** reserved for the hero search and small floating controls (blur 8-12px), always in service of legibility.
- **Focus and skip** use the same indigo language as default accents (`:focus-visible`, skip link).
- **Typography** is a single humanist-geometric sans stack (Avenir Next with system fallbacks) with a steep weight ladder on the hero.

## Colors

The palette is **void neutrals plus many satellite accents**: one cold void field, warm-violet plasma for global chrome (badge, filter pills), and per-card hues owned in markup.

### Primary

- **Plasma Violet** (`#c084fc`): Hero badge, tag-pill default glow, search focus ring tint, music toggle when playing. The "mission UI" accent that is not tied to a single product.

### Secondary

- **Signal Indigo** (`#818cf8`): Default `--card-accent`, card tags, global `:focus-visible` outline, skip link fill. The cross-tool "system" accent.

### Tertiary

- **Hyper Fuchsia** (`#e879f9`): Hero `.neon-word` gradient endpoint, typing cursor block. Pairs with indigo and plasma in the hero gradient band.

### Neutral

- **Void Navy** (`#000912`): Page background (`--bg`), `theme-color` alignment.
- **Card Ink** (`#000c18` / `rgba(0, 12, 24, 0.82)` in source): Primary card fill; previews use **Preview Dusk** (`#0a0e1a`).
- **Signal Snow** (`#f0f4ff`): Primary text.
- **Steel Mist** (`#8fa0c0`): Secondary and descriptive copy.
- **Whisper Line** (`rgba(255,255,255,0.08)`): Default borders; **Bright Mist** (`rgba(255,255,255,0.15)`) for hover border glow on cards.
- **Glass Wash** (`rgba(255,255,255,0.04)`): Hero search field; **Glass Wash+** (`rgba(255,255,255,0.06)`) on focus.

### Named Rules

**The Per-Card Beacon Rule.** Each tool card sets its own `--card-accent`, `--card-glow`, and `--card-glow-border` in inline style. Do not collapse the hub to a single brand accent for cards; the rainbow grid is the information architecture.

**The Void-First Rule.** Background stays at or near `#000912`. Do not introduce pure `#000000` or pure `#ffffff` fields; neutrals stay tinted toward the cold void.

## Typography

**Display / Body / Label Font:** Avenir Next with `-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif fallbacks.

**Character:** Confident tech catalog: tight display tracking, wide-track uppercase labels, readable body for one-line descriptions.

### Hierarchy

- **Display** (800, `clamp(2.2rem, 6vw, 4rem)`, line-height 1.1, letter-spacing -0.02em): Hero title only. Optional `.neon-word` span uses a three-stop horizontal gradient (`#818cf8` → `#c084fc` → `#e879f9`) with background-clip (existing signature; do not replicate for body copy).
- **Title** (400, 1.1rem, line-height 1.7): Hero subtitle; max-width ~500px centered.
- **Headline** (700, 1.05rem, line-height 1.3): Card titles (`.card-name`).
- **Body** (400, 0.875rem, line-height 1.6, color steel mist): Card descriptions (`.card-desc`). Keep lines under ~75ch inside cards.
- **Label** (600, 0.68-0.72rem, letter-spacing 0.1–0.12em, uppercase): Section rails (`.section-label`, `.group-label`, `.card-domain`).

### Named Rules

**The One-Stack Rule.** Do not introduce a second display serif or a monospace marketing font on the hub. Personality comes from color and motion, not from mixing unrelated families.

## Elevation

Depth is **glow-and-shadow hybrid**, not Material elevation stacks. Cards carry a low ambient shadow (`0 0 18px rgba(0,0,0,0.6)`); hover adds a **diagonal violet wash** in `::before` plus a **1px top hairline** gradient in `::after`. Drag state lifts with `0 12px 40px rgba(0,0,0,0.6)` and a 2px violet border.

Large panels (settings, terminal) use inset highlights (`0 8px 40px rgba(0,0,0,0.6)` plus 1px inner rim). Flat chrome is rare; even chips gain soft outer glow on hover.

### Shadow Vocabulary

- **Card ambient** (`0 0 18px rgba(0,0,0,0.6)`): Default resting cards.
- **Card lift (drag)** (`0 12px 40px rgba(0,0,0,0.6), 0 0 0 2px rgba(160,80,255,0.4)`): Sortable drag affordance.
- **Search focus** (`0 0 0 3px rgba(192,132,252,0.1), 0 0 24px rgba(192,132,252,0.08)`): Hero field focus ring cluster.
- **Panel depth** (`0 8px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)`): Floating panels.

### Named Rules

**The Glow-Is-State Rule.** Neon glows intensify on interaction (hover, focus, playing, matched search). Static chrome should not read brighter than interactive elements.

## Components

### Hero badge

- **Shape:** Pill (`border-radius: 20px`).
- **Fill / stroke:** Translucent plasma fill, plasma-tinted border (`rgba(160,80,255,0.25)`), uppercase microcopy, pulsing dot.
- **Purpose:** Sets tone; never blocks navigation.

### Hero search

- **Shape:** 14px radius, full width max 480px, icon inset 44px padding.
- **Fill:** Frosted `rgba(255,255,255,0.04)` with `backdrop-filter: blur(12px)`.
- **Focus:** Plasma border, dual ring shadow, slightly brighter fill.
- **Clear button:** 8px radius square, tertiary ghost styling.

### Tag constellation (`.tag-pill`)

- **Shape:** Pill, uppercase, per-pill `--pill-color` for border and glow.
- **States:** Hover brightens; `.matched` tightens glow; `.repelled` fades for non-matches.

### Site cards (`.site-card`)

- **Corner Style:** 16px outer radius (17px on gradient frame pseudo).
- **Background:** Semi-opaque deep blue (`rgba(0,12,24,0.82)`).
- **Border:** 1px `--border` default; hover uses `--card-glow-border` (per card).
- **Layout:** Flex column, 12px gap, 28px padding; icon row 44px rounded square (`border-radius: 12px`) with subtle border.
- **Domain row:** Uppercase micro label in `--card-accent`.
- **Tags:** `.card-tag` uses `color-mix` with accent for border/background at 30% / 8%.
- **Preview layer:** Full-bleed `#0a0e1a` under GIF with bottom gradient scrim to text.

### Multi-tool cards

- **Behavior:** Same shell as links; internal `.subtool-item` rows share accent variables.

### Skip link

- **Style:** Solid indigo `#818cf8` on near-black text `#000000` is avoided for body but skip uses **black text on indigo** for WCAG pop; slides from `top: -100%` to `0` on focus only.

### Footer links

- **Default:** `rgba(255,255,255,0.5)`; hover/focus-visible underline to `rgba(255,255,255,0.7)`.

### Navigation (site header)

- **Layout:** Logo + wordmark left, GitHub icon link right; bottom hairline `rgba(255,255,255,0.05)`.
- **Icon link:** 40px circle, transparent border → subtle surface on hover.

### Motion tokens (reference)

- **Snap ease:** `cubic-bezier(0.34, 1.56, 0.64, 1)` for logo playful hover.
- **Card entrance:** `0.5s cubic-bezier(0.22, 1, 0.36, 1)` bottom-up fade.

## Do's and Don'ts

### Do

- **Do** keep the tool grid as the honest center of gravity; hero and atmosphere exist to route into `#tools`.
- **Do** assign each new tool card explicit `--card-accent`, `--card-glow`, and `--card-glow-border` values consistent with OG / hub registry hues.
- **Do** respect `prefers-reduced-motion` for starfield and decorative canvases (static snapshot pattern already in codebase).
- **Do** pair icon-only header controls with `aria-label` and keep `:focus-visible` indigo ring visible.

### Don't

- **Don't** bury the catalog behind generic SaaS landing patterns that PRODUCT.md forbids: hero metrics blocks, endless identical icon-plus-blurb grids with no real links, or modal newsletter traps on first paint.
- **Don't** ship the interchangeable **"AI wrapper"** look from PRODUCT.md: purple gradients on white, stock robot illustrations, or vague "10x productivity" slabs; the hub is already dark void plus honest cards.
- **Don't** use **dark patterns** called out in PRODUCT.md: fake urgency, signup walls for read-only discovery, or ads disguised as tools.
- **Don't** flatten the hub into **corporate trust-center blandness**: removing accent discipline, killing per-card color coding, or replacing the grid with featureless gray tiles.
- **Don't** use `border-left` or `border-right` thicker than 1px as a decorative accent stripe on cards or list rows; use full borders, glow, or background tint instead (impeccable shared law).
- **Don't** add new gradient-text marketing spans outside the existing hero word treatment; prefer weight and color for emphasis elsewhere.
