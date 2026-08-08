// ── Diagram kit ──────────────────────────────────────────────
// Reusable SVG scaffolding for post diagrams, so a generator is the
// content and not 200 lines of boilerplate. Copy into <project>/post/
// and import from your build-visuals.mjs.
//
// The one rule this kit cannot enforce for you: import the numbers
// from the project's own model. A hardcoded value here is a second
// source of truth that goes stale the first time the model changes.

// ── Palette ──────────────────────────────────────────────────
// Matches the Neorgon dark canvas. Diagrams read as part of the site.
export const BG = '#040714';
export const INK = '#f9f9f9';
export const DIM = 'rgba(255,255,255,.62)';
export const MUTE = 'rgba(255,255,255,.46)';
export const LINE = 'rgba(255,255,255,.16)';
export const ACCENT = '#B015B0';

export const FONT = "'Avenir Next','Segoe UI',Roboto,sans-serif";
export const KANJI = "'Hiragino Sans','Yu Gothic',sans-serif";

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Outer canvas.
 *
 * `bg: false` drops the background rect and glow, leaving the artwork
 * on transparency for compositing into another image. Pair it with a
 * filename ending in `-bare` so the rasterizer keeps the alpha.
 */
export function frame(w, h, body, { glow = true, bg = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#1a1040" stop-opacity=".85"/>
      <stop offset="55%" stop-color="#0a0a24" stop-opacity=".45"/>
      <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  ${bg ? `<rect width="${w}" height="${h}" fill="${BG}"/>` : ''}
  ${bg && glow ? `<rect width="${w}" height="${h}" fill="url(#glow)"/>` : ''}
  ${body}
</svg>`;
}

/** Eyebrow + title + optional subtitle, top-left. */
export function heading(x, y, eyebrow, title, sub) {
  return `
  <text x="${x}" y="${y}" fill="${ACCENT}" font-size="20" font-weight="700" letter-spacing="3.4">${esc(eyebrow.toUpperCase())}</text>
  <text x="${x}" y="${y + 48}" fill="${INK}" font-size="42" font-weight="700" letter-spacing="-.4">${esc(title)}</text>
  ${sub ? `<text x="${x}" y="${y + 84}" fill="${MUTE}" font-size="21">${esc(sub)}</text>` : ''}`;
}

/** Small print along the bottom. One line; wrap by calling twice. */
export function footnote(x, y, text) {
  return `<text x="${x}" y="${y}" fill="rgba(255,255,255,.34)" font-size="17">${esc(text)}</text>`;
}

/**
 * A labelled horizontal bar, optionally with a ceiling tick.
 *
 * When the argument is about a limit, pass `ceiling` and the tick gets
 * drawn as a wall the fill stops at. Readers get that in one glance,
 * with no caption doing the work.
 *
 * `base` is where you stand before help; `total` is where you end up.
 * The gap between them renders as a lighter segment.
 */
export function bar({
  x, y, w, h = 46, label, base, total, ceiling = null, color, note = '',
  capLabel = true,
}) {
  const bw = (base / 100) * w;
  const aw = ((total - base) / 100) * w;
  const capX = ceiling === null ? null : x + (ceiling / 100) * w;
  return `
  <text x="${x - 32}" y="${y + h * 0.65}" text-anchor="end" fill="${INK}" font-size="23" font-weight="600">${esc(label)}</text>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="rgba(255,255,255,.05)"/>
  <rect x="${x}" y="${y}" width="${bw.toFixed(1)}" height="${h}" rx="8" fill="${color}" fill-opacity=".95"/>
  <rect x="${(x + bw).toFixed(1)}" y="${y}" width="${Math.max(0, aw).toFixed(1)}" height="${h}" rx="8" fill="${color}" fill-opacity=".34"/>
  ${aw > 4 ? `<rect x="${(x + bw).toFixed(1)}" y="${y}" width="2" height="${h}" fill="${BG}" opacity=".9"/>` : ''}
  ${capX === null ? '' : `<rect x="${(capX - 2).toFixed(1)}" y="${y - 10}" width="4" height="${h + 20}" rx="2" fill="${INK}"/>`}
  ${capX === null || !capLabel ? '' : `<text x="${capX - 8}" y="${y - 18}" text-anchor="end" fill="${MUTE}" font-size="18" font-weight="700">CEILING ${ceiling}%</text>`}
  <text x="${x + w + 26}" y="${y + h * 0.7}" fill="${color}" font-size="26" font-weight="700">${total}%</text>
  ${note ? `<text x="${x}" y="${y + h + 38}" fill="${MUTE}" font-size="19">${esc(note)}</text>` : ''}`;
}

/** Vertex i of an n-sided polygon with a point at the top. */
export function vertex(i, n, r, cx, cy) {
  const a = (-90 + (360 / n) * i) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** A small legend row: swatch + caption pairs. */
export function legend(x, y, items) {
  let cursor = x;
  return items.map(({ fill, text, tick = false }) => {
    const mark = tick
      ? `<rect x="${cursor}" y="${y - 3}" width="4" height="24" rx="2" fill="${fill}"/>`
      : `<rect x="${cursor}" y="${y}" width="18" height="18" rx="4" fill="${fill}"/>`;
    const label = `<text x="${cursor + (tick ? 18 : 28)}" y="${y + 15}" fill="${MUTE}" font-size="18">${esc(text)}</text>`;
    cursor += (tick ? 18 : 28) + text.length * 9 + 34;
    return mark + label;
  }).join('');
}

/**
 * Write every diagram and report sizes.
 * Pass an object of { 'NN-name.svg': svgString }.
 */
export function emit(files, outDir, { writeFileSync, join }) {
  for (const [name, svg] of Object.entries(files)) {
    writeFileSync(join(outDir, name), svg);
    console.log(`wrote ${name} ${(svg.length / 1024).toFixed(1)}kb`);
  }
}
