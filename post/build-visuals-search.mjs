/**
 * Diagrams for "The page that hid its own answer".
 *
 * Every number here is READ, not typed. The icon figures come from parsing the
 * actual SVG files on both sides of the change — `git show HEAD:...` for the
 * before state, the working tree for the after — and the accent-token figure
 * comes from grepping css/style.css. If someone re-weights an icon or moves a
 * card element off `--card-accent`, these diagrams change with them.
 *
 * The one exception is the search-stack geometry: those are browser
 * measurements, which no function in this repo can return. They live in
 * MEASURED below with the exact conditions they were taken under, and they are
 * copied from `.forge/brief.md` § Measured — one place to check.
 *
 *   node post/build-visuals-search.mjs && node post/rasterize.mjs
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frame, heading, footnote, legend, emit, esc,
         BG, INK, DIM, MUTE, LINE, ACCENT } from './diagram-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const RENDER_PX = 28;   // .card-site-icon width in css/style.css

/* ── Read the model ──────────────────────────────────────────────────── */

/** Icons the linter covers: rendered as .card-site-icon, minus third-party marks. */
const EXEMPT = new Set(['github.svg', 'gitlab.svg', 'docker.svg', 'youtube.svg']);

function cardIcons() {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const names = new Set();
  // Masked `<span style="--icon: url('/assets/icons/x.svg')">` for our own icons,
  // `<img src="...">` for the third-party marks. Matching only `<img>` made this
  // generator emit a chart of NaN the day the markup changed, so match both.
  for (const tag of html.match(/<(?:img|span)\b[^>]*>/g) || []) {
    if (!tag.includes('card-site-icon')) continue;
    const m = tag.match(/(?:src="|--icon:\s*url\(')\/?assets\/icons\/([A-Za-z0-9._-]+\.svg)/);
    if (m && !EXEMPT.has(m[1])) names.add(m[1]);
  }
  return [...names].sort();
}

/** stroke-width / viewBox-size * 28 — what the eye actually sees. */
function effectiveStroke(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/);
  if (!vb) return null;
  const parts = vb[1].replace(/,/g, ' ').split(/\s+/).map(Number);
  const size = Math.max(parts[2], parts[3]);
  const widths = [...svg.matchAll(/stroke-width="([^"]+)"/g)].map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!widths.length || !size) return null;
  // An icon with several weights is judged by its heaviest: that is what reads.
  return (Math.max(...widths) / size) * RENDER_PX;
}

function atHead(path) {
  try {
    return execFileSync('git', ['show', `HEAD:${path}`], { cwd: ROOT, encoding: 'utf8' });
  } catch { return null; }
}

const icons = cardIcons();
const rows = icons.map((name) => {
  const rel = `assets/icons/${name}`;
  const before = atHead(rel);
  const after = readFileSync(join(ROOT, rel), 'utf8');
  return {
    name: name.replace(/\.svg$/, ''),
    before: before ? effectiveStroke(before) : null,
    after: effectiveStroke(after),
  };
}).filter((r) => r.before !== null && r.after !== null);

/* A diagram built from an empty set renders as NaN and still writes a file, which
   is worse than crashing: it looks like output. Fail loudly instead. */
if (rows.length < 20) {
  console.error(`only ${rows.length} icons resolved from index.html — this generator is not `
    + 'reading the right markup, so any chart it produces is meaningless.');
  process.exit(2);
}

const beforeVals = rows.map((r) => r.before);
const afterVals = rows.map((r) => r.after);
const bMin = Math.min(...beforeVals), bMax = Math.max(...beforeVals);
const aMin = Math.min(...afterVals), aMax = Math.max(...afterVals);

/** Which card elements take their colour from --card-accent?
 *
 *  The icon is listed under two selectors because it changed shape as well as
 *  colour: at HEAD it was `.card-site-icon` on an `<img>` with a hardcoded
 *  magenta glow; it is now `span.card-site-icon`, a masked element taking the
 *  accent. Same thing on the card, so it gets one row. */
function accentUsers() {
  const css = readFileSync(join(ROOT, 'css/style.css'), 'utf8');
  const head = atHead('css/style.css') || css;
  const want = [
    { label: '.card-tag' },
    { label: '.card-domain' },
    { label: '.card-initial' },
    { label: '.soon-badge' },
    { label: '.card-new-badge' },
    { label: '.card-site-icon', beforeSel: '.card-site-icon', afterSel: 'span.card-site-icon' },
  ];
  const check = (source, sel) => {
    const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = source.match(new RegExp(`(^|\\n)\\s*${esc}\\s*\\{[^}]*\\}`, 's'));
    return m ? /var\(--card-accent/.test(m[0]) : false;
  };
  return want.map(({ label, beforeSel, afterSel }) => ({
    sel: label,
    before: check(head, beforeSel || label),
    after: check(css, afterSel || label),
  }));
}
const accents = accentUsers();

/* ── Browser measurements (see .forge/brief.md § Measured) ───────────── */
const MEASURED = {
  conditions: 'Chrome 1280x800, 6 favorites saved, query "json"',
  // Vertical stack sitting between the search field and the first match.
  stack: [
    { label: 'Constellation pills', px: 200 },
    { label: 'Your favorites',      px: 660 },
    { label: 'Recently shipped',    px: 654 },
    { label: 'Category rail',       px: 62 },
  ],
  gapBefore: 1747,
  gapAfter: 126,
  chipRow: 23,
};

/* ── 20 · the stack between question and answer ──────────────────────── */
function searchStack() {
  const W = 1240;
  const colW = 260, beforeX = 300, afterX = 780;
  const scale = 0.30;              // one page pixel -> 0.30 diagram pixels
  const top = 340;                 // top edge of the stack, both columns
  const cardH = 120;
  /* Height follows the stack. A fixed 1010 was tuned to one set of measurements
     and the footnote ran through the FIRST MATCH box the moment they changed. */
  const stackPx = MEASURED.stack.reduce((n, s) => n + s.px, 0) * scale;
  const H = top + stackPx + 8 + cardH + 96;

  let y = top, segs = '';
  for (const s of MEASURED.stack) {
    const h = s.px * scale;
    const tall = h > 34;
    segs += `
    <rect x="${beforeX}" y="${y.toFixed(1)}" width="${colW}" height="${(h - 4).toFixed(1)}" rx="6"
          fill="${ACCENT}" fill-opacity=".18" stroke="${ACCENT}" stroke-opacity=".38"/>
    <text x="${beforeX + colW / 2}" y="${(y + h / 2 + (tall ? 2 : 1)).toFixed(1)}" text-anchor="middle"
          fill="${INK}" font-size="${tall ? 18 : 15}" font-weight="600">${esc(s.label)}</text>
    <text x="${beforeX + colW + 18}" y="${(y + h / 2 + 6).toFixed(1)}"
          fill="${MUTE}" font-size="17">${s.px}px</text>`;
    y += h;
  }
  const beforeCardY = y + 8;
  const chipH = MEASURED.chipRow * scale;
  const afterCardY = top + chipH + 14;

  const field = (x) => `
    <rect x="${x}" y="${top - 96}" width="${colW}" height="56" rx="10"
          fill="rgba(255,255,255,.06)" stroke="${LINE}"/>
    <text x="${x + colW / 2}" y="${top - 61}" text-anchor="middle" fill="${DIM}" font-size="19">type "json"</text>`;

  const card = (x, yy) => `
    <rect x="${x}" y="${yy}" width="${colW}" height="${cardH}" rx="10"
          fill="rgba(74,222,128,.07)" stroke="#4ade80" stroke-opacity=".6"/>
    <text x="${x + colW / 2}" y="${yy + cardH / 2 + 7}" text-anchor="middle" fill="#4ade80"
          font-size="20" font-weight="700">FIRST MATCH</text>`;

  // Vertical bracket spanning field-bottom to card-top, with the number outside it.
  const bracket = (x, y1, y2, color, label) => `
    <path d="M${x} ${y1} L${x} ${y2}" stroke="${color}" stroke-width="3"/>
    <path d="M${x - 9} ${y1} h18 M${x - 9} ${y2} h18" stroke="${color}" stroke-width="3"/>
    <text x="${x - 20}" y="${((y1 + y2) / 2 + 11).toFixed(1)}" text-anchor="end" fill="${color}"
          font-size="32" font-weight="700">${esc(label)}</text>`;

  const body = `
  ${heading(80, 92, 'search', `The answer was ${MEASURED.gapBefore}px below the question`,
            MEASURED.conditions)}

  <text x="${beforeX}" y="${top - 126}" fill="${MUTE}" font-size="20" font-weight="700" letter-spacing="2.5">BEFORE</text>
  ${field(beforeX)}
  ${segs}
  ${card(beforeX, beforeCardY)}
  ${bracket(beforeX - 60, top, beforeCardY, ACCENT, `${MEASURED.gapBefore}px`)}

  <text x="${afterX}" y="${top - 126}" fill="#4ade80" font-size="20" font-weight="700" letter-spacing="2.5">AFTER</text>
  ${field(afterX)}
  <rect x="${afterX}" y="${top}" width="${colW}" height="${chipH.toFixed(1)}" rx="3"
        fill="#4ade80" fill-opacity=".3" stroke="#4ade80" stroke-opacity=".5"/>
  <text x="${afterX + colW + 18}" y="${(top + chipH + 4).toFixed(1)}" fill="${MUTE}" font-size="17">${MEASURED.chipRow}px</text>
  <text x="${afterX}" y="${(afterCardY + cardH + 40).toFixed(1)}" fill="${DIM}" font-size="18">The chip row replaces the 200px</text>
  <text x="${afterX}" y="${(afterCardY + cardH + 66).toFixed(1)}" fill="${DIM}" font-size="18">pill cloud: same signal, one</text>
  <text x="${afterX}" y="${(afterCardY + cardH + 92).toFixed(1)}" fill="${DIM}" font-size="18">eighth the height.</text>
  ${card(afterX, afterCardY)}
  ${bracket(afterX - 60, top, afterCardY, '#4ade80', `${MEASURED.gapAfter}px`)}

  ${footnote(80, H - 76, 'Same viewport, same query, drawn to scale. The four blocks are browse surfaces:')}
  ${footnote(80, H - 46, 'none of them can hold a match that the merged results grid does not already show.')}`;
  return frame(W, H, body);
}

/* ── 21 · effective stroke, before and after ─────────────────────────── */
function strokeSpread() {
  const W = 1240, H = 890;
  const x0 = 130, x1 = 1130, plotW = x1 - x0;
  const yB = 440, yA = 680;                 // baselines; bars grow upward
  const panelH = 168, barW = 26, maxVal = 3.0;
  const px = (v) => x0 + (v / maxVal) * plotW;

  const bucket = (vals) => {
    const m = new Map();
    for (const v of vals) m.set(v.toFixed(3), (m.get(v.toFixed(3)) || 0) + 1);
    return [...m.entries()].map(([k, n]) => ({ v: Number(k), n }));
  };
  const bBuckets = bucket(beforeVals), aBuckets = bucket(afterVals);
  /* One scale for both panels, or the two rows cannot be compared by eye. */
  const maxN = Math.max(...bBuckets.map((b) => b.n), ...aBuckets.map((b) => b.n));
  const hOf = (n) => (n / maxN) * panelH;

  const bars = (buckets, baseline, color) => buckets.map(({ v, n }) => {
    const h = hOf(n), x = px(v) - barW / 2;
    return `
    <rect x="${x.toFixed(1)}" y="${(baseline - h).toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="4"
          fill="${color}" fill-opacity=".85"/>
    <text x="${px(v).toFixed(1)}" y="${(baseline - h - 12).toFixed(1)}" text-anchor="middle"
          fill="${color}" font-size="18" font-weight="700">${n}</text>`;
  }).join('');

  const axis = [0, 0.5, 1, 1.5, 2, 2.5, 3].map((t) => `
    <path d="M${px(t)} ${yB - panelH - 40} L${px(t)} ${yA + 16}" stroke="${LINE}" stroke-width="1"/>
    <text x="${px(t)}" y="${yA + 52}" text-anchor="middle" fill="${MUTE}" font-size="17">${t.toFixed(1)}px</text>`).join('');

  const body = `
  ${heading(80, 92, 'icons', 'One weight, or a different call every time',
            `Effective stroke = stroke-width / viewBox x ${RENDER_PX}px. Bar height is how many icons drew at that weight.`)}
  ${axis}
  <path d="M${x0} ${yB} L${x1} ${yB}" stroke="${LINE}" stroke-width="1.5"/>
  <path d="M${x0} ${yA} L${x1} ${yA}" stroke="${LINE}" stroke-width="1.5"/>
  <text x="${x0 - 26}" y="${yB - 4}" text-anchor="end" fill="${INK}" font-size="23" font-weight="600">before</text>
  ${bars(bBuckets, yB, ACCENT)}
  <path d="M${px(bMin)} ${yB + 26} L${px(bMax)} ${yB + 26}" stroke="${ACCENT}" stroke-width="3" stroke-opacity=".6"/>
  <path d="M${px(bMin)} ${yB + 18} v16 M${px(bMax)} ${yB + 18} v16" stroke="${ACCENT}" stroke-width="3"/>
  <text x="${((px(bMin) + px(bMax)) / 2).toFixed(1)}" y="${yB + 58}" text-anchor="middle"
        fill="${ACCENT}" font-size="21" font-weight="700">${bMin.toFixed(2)}px to ${bMax.toFixed(2)}px, a ${(bMax / bMin).toFixed(1)}x spread</text>
  <text x="${x0 - 26}" y="${yA - 4}" text-anchor="end" fill="${INK}" font-size="23" font-weight="600">after</text>
  ${bars(aBuckets, yA, '#4ade80')}
  <text x="${(px(aMax) + 34).toFixed(1)}" y="${(yA - hOf(rows.length) / 2).toFixed(1)}" fill="#4ade80"
        font-size="21" font-weight="700">every one at ${aMax.toFixed(2)}px</text>
  ${footnote(80, H - 76, `Read from the files themselves: before = git HEAD, after = working tree. ${rows.length} of the ${cardIcons().length} linted icons appear here;`)}
  ${footnote(80, H - 46, 'the other two were solid-fill glyphs with no stroke to measure until this change gave them one.')}`;
  return frame(W, H, body);
}

/* ── 22 · the one card element that ignored the card ─────────────────── */
function accentTokens() {
  const W = 1240;
  const x = 268, rowH = 74, top = 340;   // x clears the longest selector name
  /* Height follows the row count. Adding the icon row made a fixed 770 overlap
     the footnote, and the next selector added would have done it again. */
  const H = top + (accents.length - 1) * rowH + 120;
  const col = (ok) => (ok ? '#4ade80' : ACCENT);
  const rowsSvg = accents.map((a, i) => {
    const y = top + i * rowH;
    const cell = (cx, ok) => `
      <rect x="${cx}" y="${y - 26}" width="150" height="46" rx="8"
            fill="${col(ok)}" fill-opacity="${ok ? '.2' : '.16'}" stroke="${col(ok)}" stroke-opacity=".5"/>
      <text x="${cx + 75}" y="${y + 4}" text-anchor="middle" fill="${col(ok)}"
            font-size="17" font-weight="700">${ok ? 'card accent' : 'its own'}</text>`;
    return `
    <text x="${x - 24}" y="${y + 4}" text-anchor="end" fill="${INK}" font-size="21"
          font-weight="600" font-family="monospace">${esc(a.sel)}</text>
    ${cell(x, a.before)}
    ${cell(x + 210, a.after)}`;
  }).join('');

  const body = `
  ${heading(80, 92, 'colour', "Everything on a card takes the card's colour",
            'Which selectors in css/style.css resolve their colour from var(--card-accent)')}
  <text x="${x + 75}" y="${top - 62}" text-anchor="middle" fill="${MUTE}" font-size="19" font-weight="700" letter-spacing="2">BEFORE</text>
  <text x="${x + 285}" y="${top - 62}" text-anchor="middle" fill="#4ade80" font-size="19" font-weight="700" letter-spacing="2">AFTER</text>
  ${rowsSvg}
  ${legend(x + 440, top - 78, [
    { fill: '#4ade80', text: 'takes the card colour' },
    { fill: ACCENT, text: 'hardcodes its own' },
  ])}
  <text x="${x + 440}" y="${top + 26}" fill="${DIM}" font-size="19">Two holdouts. The NEW badge was a</text>
  <text x="${x + 440}" y="${top + 54}" fill="${DIM}" font-size="19">solid amber gradient, the only warm</text>
  <text x="${x + 440}" y="${top + 82}" fill="${DIM}" font-size="19">saturated fill in a cool interface.</text>
  <text x="${x + 440}" y="${top + 110}" fill="${DIM}" font-size="19">The icon was fleet magenta on every</text>
  <text x="${x + 440}" y="${top + 138}" fill="${DIM}" font-size="19">card, whatever colour the card was.</text>
  ${footnote(80, H - 44, 'Read by matching each selector block in css/style.css against git HEAD.')}`;
  return frame(W, H, body);
}

emit({
  '20-search-stack.svg': searchStack(),
  '21-stroke-spread.svg': strokeSpread(),
  '22-accent-tokens.svg': accentTokens(),
}, HERE, { writeFileSync, join });

console.log(`\nicons parsed: ${rows.length}`);
console.log(`before: ${bMin.toFixed(2)}px – ${bMax.toFixed(2)}px  (${(bMax / bMin).toFixed(2)}x spread)`);
console.log(`after : ${aMin.toFixed(2)}px – ${aMax.toFixed(2)}px`);
console.log('accent tokens:', accents.map((a) => `${a.sel} ${a.before ? 'Y' : 'n'}->${a.after ? 'Y' : 'n'}`).join(', '));
