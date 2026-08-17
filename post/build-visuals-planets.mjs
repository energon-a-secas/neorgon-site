/**
 * Diagrams for "I deleted the thing I wrote a blog post defending".
 *
 * Every figure here is READ out of js/search.js, not typed. Category
 * membership comes from parsing the CATEGORIES array, the score ladder from
 * parsing the SCORE table, and the depth spread by evaluating the same
 * expression the module uses. Re-weight a score or move a card between
 * categories and these diagrams move with it.
 *
 * The one exception is the fold geometry, which no function in this repo can
 * return because it is a browser measurement. Those live in MEASURED below
 * with the conditions they were taken under, copied from `.forge/brief.md`
 * § Measured, so there is one place to check.
 *
 *   node post/build-visuals-planets.mjs && node post/rasterize.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frame, heading, footnote, legend, emit, esc,
         BG, INK, DIM, MUTE, LINE, ACCENT } from './diagram-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC = readFileSync(join(ROOT, 'js/search.js'), 'utf8');

/* ── Read the model ──────────────────────────────────────────────────── */

/** Every curated category: label, colour, and the cards it owns. */
function categories() {
  const block = SRC.slice(SRC.indexOf('const CATEGORIES = ['));
  const rows = block.slice(0, block.indexOf('\n  ];')).split('\n');
  const out = [];
  for (const line of rows) {
    const label = /label:\s*'([^']+)'/.exec(line);
    const color = /color:\s*'([^']+)'/.exec(line);
    const ids = /ids:\s*\[([^\]]*)\]/.exec(line);
    if (!label || !ids) continue;
    out.push({
      label: label[1],
      color: color ? color[1] : ACCENT,
      ids: ids[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')).filter(Boolean),
    });
  }
  if (!out.length) throw new Error('CATEGORIES not parsed — did the array shape change?');
  return out;
}

/** The score ladder, straight out of the SCORE table. */
function scores() {
  const block = SRC.slice(SRC.indexOf('var SCORE = {'));
  const body = block.slice(0, block.indexOf('};'));
  const out = {};
  for (const [, k, v] of body.matchAll(/(\w+):\s*(\d+)/g)) out[k] = +v;
  if (!Object.keys(out).length) throw new Error('SCORE not parsed');
  return out;
}

/** The standing depth each pill gets, computed with the module's own formula. */
function depths(n) {
  const m = /var depth = ([\d.]+) \+ \(\(i \* (\d+)\) % (\d+)\) \/ \3 \* ([\d.]+);/.exec(SRC);
  if (!m) throw new Error('depth formula not parsed — it moved or changed shape');
  const [, base, stride, period, span] = m;
  return Array.from({ length: n }, (_, i) =>
    +base + ((i * +stride) % +period) / +period * +span);
}

/* ── Measured in a browser, not derivable here ───────────────────────── */
/* 1280x800, no favorites saved, no-store local server, read via
   getBoundingClientRect against the live page. */
const MEASURED = {
  shelfBefore: 609, shelfAfter: 379,
  railBefore: 1297, railAfter: 1132,
  scaleFloor: 0.72, scaleCeil: 1.31,
};

const CATS = categories();
const SCORE = scores();
const DEPTH = depths(CATS.length);
const SOCIAL = CATS.find(c => c.label === 'Social');

/* ── 01 · what one query used to mean ────────────────────────────────── */
function whatParlaMatched() {
  /* 1200 wide leaves the right column about 48 characters at font-size 19, so
     its caption wraps rather than running off the canvas. Learned by rendering
     it once and reading the clipped word. */
  const W = 1200, H = 640;
  const cardW = 150, cardH = 62, gap = 18;
  const cols = 3;
  const draw = (x0, y0, ids, lit) => ids.map((id, k) => {
    const cx = x0 + (k % cols) * (cardW + gap);
    const cy = y0 + Math.floor(k / cols) * (cardH + gap);
    const on = lit.includes(id);
    return `
    <rect x="${cx}" y="${cy}" width="${cardW}" height="${cardH}" rx="10"
          fill="${on ? SOCIAL.color : 'rgba(255,255,255,.045)'}" fill-opacity="${on ? .9 : 1}"
          stroke="${on ? SOCIAL.color : LINE}" stroke-width="${on ? 2 : 1}"/>
    <text x="${cx + cardW / 2}" y="${cy + cardH / 2 + 7}" text-anchor="middle"
          fill="${on ? BG : MUTE}" font-size="19" font-weight="${on ? 700 : 500}">${esc(id)}</text>`;
  }).join('');

  const body = `
  ${heading(70, 84, 'one query', 'Searching “parla”',
            `Social owns ${SOCIAL.ids.length} tools. One of them is called Parla.`)}

  <text x="70" y="252" fill="${DIM}" font-size="23" font-weight="600">BEFORE · the keyword blob promoted the group</text>
  ${draw(70, 282, SOCIAL.ids, SOCIAL.ids)}
  <text x="70" y="${282 + 2 * (cardH + gap) + 34}" fill="${MUTE}" font-size="19">${SOCIAL.ids.length} results. Parla ranked fourth, because Social</text>
  <text x="70" y="${282 + 2 * (cardH + gap) + 60}" fill="${MUTE}" font-size="19">sits fourth in the DOM.</text>

  <line x1="640" y1="240" x2="640" y2="520" stroke="${LINE}" stroke-width="1"/>

  <text x="700" y="252" fill="${DIM}" font-size="23" font-weight="600">AFTER · the query named a card</text>
  ${draw(700, 282, SOCIAL.ids, ['parla'])}
  <text x="700" y="${282 + 2 * (cardH + gap) + 34}" fill="${MUTE}" font-size="19">1 result. The blob only opens a group when</text>
  <text x="700" y="${282 + 2 * (cardH + gap) + 60}" fill="${MUTE}" font-size="19">nothing matched directly.</text>

  ${footnote(70, 600, 'Membership read from the CATEGORIES array in js/search.js at build time.')}`;
  return frame(W, H, body);
}

/* ── 02 · the ladder that decides the order ──────────────────────────── */
function scoreLadder() {
  /* Ten rows at 44px need 440 of vertical, and the first render put the legend
     and the footnote straight through the last two of them. The canvas grows;
     the rows do not shrink. */
  const W = 1200, H = 880;
  const order = ['nameExact', 'nameWord', 'nameLoose', 'catExact', 'domain',
                 'tag', 'desc', 'loose', 'catLabel', 'catKeyword'];
  const LABEL = {
    nameExact: 'name is the query', nameWord: 'name starts a word',
    nameLoose: 'name contains it', catExact: 'query IS a category label',
    domain: 'domain or id', tag: 'a tag', desc: 'the description',
    loose: 'somewhere, mid-word', catLabel: 'part of a label',
    catKeyword: 'fallback vocabulary',
  };
  const max = Math.max(...order.map(k => SCORE[k]));
  const x0 = 430, barW = 620, rowH = 44;

  const rows = order.map((k, i) => {
    const y = 250 + i * rowH;
    const w = (SCORE[k] / max) * barW;
    const isCat = k.startsWith('cat');
    return `
    <text x="${x0 - 24}" y="${y + 21}" text-anchor="end" fill="${isCat ? MUTE : INK}"
          font-size="20" font-weight="${isCat ? 500 : 600}">${esc(LABEL[k])}</text>
    <rect x="${x0}" y="${y}" width="${w.toFixed(1)}" height="28" rx="6"
          fill="${isCat ? MUTE : ACCENT}" fill-opacity="${isCat ? .38 : .92}"/>
    <text x="${x0 + w + 16}" y="${y + 21}" fill="${isCat ? MUTE : INK}"
          font-size="20" font-weight="700">${SCORE[k]}</text>`;
  }).join('');

  const body = `
  ${heading(70, 84, 'ranking', 'What beats what',
            'There was no ladder before. Matches came out in the order the HTML lists them.')}
  ${rows}
  ${legend(430, 740, [
    { fill: ACCENT, text: 'the card itself matched' },
    { fill: MUTE, text: 'it belongs to a category that matched' },
  ])}
  ${footnote(70, 826, 'Values read from the SCORE table in js/search.js. Ties break on ship date, newest first.')}`;
  return frame(W, H, body);
}

/* ── 03 · depth, which is why it reads as a field ────────────────────── */
function depthField() {
  const W = 1200, H = 620;
  const x0 = 90, span = 1020;
  const lo = Math.min(...DEPTH), hi = Math.max(...DEPTH);

  /* Place, then separate. x is depth so it is not negotiable; y starts on a
     scatter and is pushed apart until nothing overlaps. Two pills at the same
     depth landed on top of each other in the first render, which is the one
     thing a diagram about distance must not do. */
  const boxes = CATS.map((c, i) => {
    const d = DEPTH[i];
    const t = (d - lo) / (hi - lo);
    return {
      c, d,
      x: x0 + 40 + t * (span - 210),
      y: 292 + Math.sin(i * 1.9) * 92,
      w: 34 + c.label.length * 9.6 * d,
      h: 30 * d,
    };
  });
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let a = 0; a < boxes.length; a++) {
      for (let b = a + 1; b < boxes.length; b++) {
        const A = boxes[a], B = boxes[b];
        const dx = Math.abs(A.x - B.x), dy = Math.abs(A.y - B.y);
        const needX = (A.w + B.w) / 2 + 16, needY = (A.h + B.h) / 2 + 14;
        if (dx >= needX || dy >= needY) continue;
        const push = (needY - dy) / 2 + 1;
        const dir = A.y <= B.y ? -1 : 1;
        A.y += dir * push; B.y -= dir * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const pills = boxes.map(({ c, d, x, y, w, h }) => {
    return `
    <rect x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}"
          width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${(h / 2).toFixed(1)}"
          fill="${c.color}" fill-opacity="${(0.06 + 0.08 * d).toFixed(3)}"
          stroke="${c.color}" stroke-opacity="${(0.22 + 0.5 * d).toFixed(3)}" stroke-width="1.4"/>
    <text x="${x.toFixed(1)}" y="${(y + 4.5 * d).toFixed(1)}" text-anchor="middle"
          fill="${c.color}" fill-opacity="${(0.45 + 0.55 * d).toFixed(3)}"
          font-size="${(12.5 * d).toFixed(1)}" font-weight="700"
          letter-spacing="${(0.8 * d).toFixed(2)}">${esc(c.label.toUpperCase())}</text>`;
  }).join('');

  const body = `
  ${heading(70, 84, 'depth', 'Twelve labels, twelve distances',
            'Same cloud. The only change is that each pill has a standing size.')}
  <line x1="${x0}" y1="470" x2="${x0 + span}" y2="470" stroke="${LINE}" stroke-width="1"/>
  <text x="${x0}" y="502" fill="${MUTE}" font-size="18">far · ${lo.toFixed(2)}</text>
  <text x="${x0 + span}" y="502" text-anchor="end" fill="${MUTE}" font-size="18">near · ${hi.toFixed(2)}</text>
  ${pills}
  ${footnote(70, 552, 'Depths computed with the same expression js/search.js uses.')}
  ${footnote(70, 578, `On a query the live field spans ${MEASURED.scaleFloor} to ${MEASURED.scaleCeil}, because selection multiplies on top of depth.`)}`;
  return frame(W, H, body);
}

emit({
  '30-parla-membership.svg': whatParlaMatched(),
  '31-score-ladder.svg': scoreLadder(),
  '32-depth-field.svg': depthField(),
}, HERE, { writeFileSync, join });
