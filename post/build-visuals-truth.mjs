// ── Diagrams for "A card that cannot lie" ────────────────────
// Run from anywhere:
//   node post/build-visuals-truth.mjs && node post/rasterize.mjs
//
// Same rule as build-visuals.mjs: this hub has no js/data.js, so its
// model is the DOM plus the two modules that animate it. Every number
// below is read out of those files and every reader throws if what it
// is looking for has moved.
//
//   readCatalog()   — index.html: #tools cards, in document order, with
//                     their group, ship date and status. Document order
//                     is the whole point here: the bug this post is
//                     about was a card's *position* leaking into a
//                     shelf that had nothing to do with position.
//   readTiming()    — js/entrance.js + js/recent.js: STEP, CAP,
//                     RAIL_SIZE, NEW_DAYS, and the superseded 110ms
//                     that entrance.js still names in its own comment.
//
// build-visuals.mjs has a readCatalog() too. It returns per-group
// aggregates and throws away order, which is exactly what these
// diagrams need, so the two coexist rather than one wrapping the other.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  frame, heading, footnote, legend, emit,
  BG, INK, DIM, MUTE, LINE, ACCENT, esc,
} from './diagram-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..');
const read = (p) => readFileSync(join(SITE, p), 'utf8');

/* The badge count decays with the calendar, so "today" is the day the
   work landed rather than the day someone rebuilds the diagrams. */
const AS_OF = Date.UTC(2026, 7, 11);
const DAY = 86400000;
const ageDays = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (AS_OF - Date.UTC(y, m - 1, d)) / DAY;
};

/* ── Reader 1: every card in #tools, in document order ─────────── */
function readCatalog() {
  const html = read('index.html');
  const from = html.indexOf('<main class="sites-section" id="tools"');
  const to = html.indexOf('</main>', from);
  if (from < 0 || to < 0) throw new Error('index.html: could not find <main id="tools">');
  const tools = html.slice(from, to);

  const chunks = tools.split(/<div class="card-group"[^>]*id="(group-[a-z-]+)"[^>]*>/);
  if (chunks.length < 3) throw new Error('index.html: no .card-group sections matched');

  const cards = [];
  for (let i = 1; i < chunks.length; i += 2) {
    const groupId = chunks[i];
    const body = chunks[i + 1];
    const raw = (body.match(/class="group-label"[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
    if (!raw) throw new Error(`${groupId}: no .group-label heading`);
    const label = raw.replace(/<[^>]*>/g, '').trim();

    let inGroup = 0;
    for (const m of body.matchAll(/<(?:a|div)\s+class="site-card([^"]*)"([^>]*)>/g)) {
      const cls = m[1];
      const attrs = m[2];
      const id = (attrs.match(/data-card-id="([a-z0-9-]+)"/) || [])[1];
      if (!id) continue;
      cards.push({
        id,
        group: label,
        groupId,
        indexInGroup: inGroup++,
        added: (attrs.match(/data-added="(\d{4}-\d{2}-\d{2})"/) || [])[1] || null,
        soon: /data-status="soon"/.test(attrs),
        external: /\bexternal-card\b/.test(cls),
      });
    }
  }
  if (!cards.length) throw new Error('index.html: parsed zero cards');
  return cards.map((c, i) => ({ ...c, indexGlobal: i }));
}

/* ── Reader 2: the constants that decide when a card appears ───── */
function readTiming() {
  const entrance = read('js/entrance.js');
  const recent = read('js/recent.js');
  const one = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`could not read ${what}: the constant moved`);
    return Number(m[1]);
  };
  return {
    step: one(entrance, /const STEP = (\d+)/, 'STEP from entrance.js'),
    cap: one(entrance, /const CAP = (\d+)/, 'CAP from entrance.js'),
    /* The superseded value has no variable left to read. entrance.js
       names it in the comment explaining what it replaced, so that
       sentence is its source: edit the comment and the chart follows. */
    oldStep: one(entrance, /delay = index \* (\d+)ms/, 'the old global step from the entrance.js comment'),
    railSize: one(recent, /var RAIL_SIZE = (\d+)/, 'RAIL_SIZE from recent.js'),
    newDays: one(recent, /var NEW_DAYS = (\d+)/, 'NEW_DAYS from recent.js'),
    echoStep: one(recent, /\(i \* (\d+)\) \+ 'ms'/, "the rail's own stagger from recent.js"),
  };
}

const CARDS = readCatalog();
const T = readTiming();

const LIVE = CARDS.filter((c) => !c.external && !c.soon);
const SOON = CARDS.filter((c) => c.soon);
const EXTERNAL = CARDS.filter((c) => c.external);

/* recent.js's own eligibility rule, restated here because it is a
   filter and not an exported function. */
const RAILABLE = CARDS
  .filter((c) => c.added && !c.external && !c.soon)
  .sort((a, b) => b.added.localeCompare(a.added));
const RAIL = RAILABLE.slice(0, T.railSize);
const FRESH = RAILABLE.filter((c) => ageDays(c.added) <= T.newDays);

const oldDelay = (c) => c.indexGlobal * T.oldStep;
const newDelay = (c) => Math.min(c.indexInGroup, T.cap) * T.step;

const OLD_WORST = Math.max(...CARDS.map(oldDelay));
const NEW_WORST = Math.max(...CARDS.map(newDelay));
const OLD_RAIL_LAST = Math.max(...RAIL.map(oldDelay));
const NEW_RAIL_LAST = (T.railSize - 1) * T.echoStep;

/* ── 10 — when each card actually showed up ───────────────────── */
function entranceTimeline() {
  const W = 1200, H = 700;
  const x0 = 250, x1 = 1120;
  const T_MAX = Math.ceil(OLD_WORST / 1000) * 1000;
  const sx = (ms) => x0 + (ms / T_MAX) * (x1 - x0);

  const rowsSpec = [
    { y: 262, label: 'Catalog', tone: 'before', set: CARDS, at: oldDelay },
    { y: 322, label: 'The new shelf', tone: 'before', set: RAIL, at: oldDelay },
    { y: 452, label: 'Catalog', tone: 'after', set: CARDS, at: newDelay },
    { y: 512, label: 'The new shelf', tone: 'after', set: RAIL, at: (c) => RAIL.indexOf(c) * T.echoStep },
  ];

  const rows = rowsSpec.map(({ y, label, tone, set, at }) => {
    const fill = tone === 'before'
      ? (label === 'Catalog' ? 'rgba(255,255,255,.34)' : ACCENT)
      : (label === 'Catalog' ? 'rgba(255,255,255,.5)' : ACCENT);
    const ticks = set.map((c) => {
      const tx = sx(at(c));
      return `<rect x="${(tx - 1.5).toFixed(1)}" y="${y - 15}" width="3" height="30" rx="1.5" fill="${fill}" fill-opacity=".9"/>`;
    }).join('');
    const last = Math.max(...set.map(at));
    return `
    <text x="${x0 - 24}" y="${y + 7}" text-anchor="end" fill="${label === 'Catalog' ? MUTE : INK}" font-size="21" font-weight="${label === 'Catalog' ? 400 : 600}">${esc(label)}</text>
    <line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${LINE}" stroke-width="1"/>
    ${ticks}
    <text x="${Math.min(sx(last) + 16, x1 - 90)}" y="${y + 6}" fill="${label === 'Catalog' ? MUTE : ACCENT}" font-size="18" font-weight="700">${(last / 1000).toFixed(2)}s</text>`;
  }).join('');

  const axis = Array.from({ length: T_MAX / 1000 + 1 }, (_, i) => {
    const tx = sx(i * 1000);
    return `<line x1="${tx}" y1="230" x2="${tx}" y2="556" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 7"/>
    <text x="${tx}" y="586" text-anchor="middle" fill="${MUTE}" font-size="17">${i}s</text>`;
  }).join('');

  return frame(W, H, `
  ${heading(80, 84, 'entrance', 'Every card, and the moment it appeared',
    `${CARDS.length} cards. One tick each.`)}

  <text x="${x0 - 24}" y="236" text-anchor="end" fill="${ACCENT}" font-size="17" font-weight="700" letter-spacing="2">BEFORE</text>
  <text x="${x0 - 24}" y="426" text-anchor="end" fill="${ACCENT}" font-size="17" font-weight="700" letter-spacing="2">AFTER</text>
  ${axis}
  ${rows}

  <line x1="${sx(1000)}" y1="212" x2="${sx(1000)}" y2="556" stroke="${INK}" stroke-width="3"/>
  <text x="${sx(1000) + 14}" y="206" fill="${INK}" font-size="18" font-weight="700">one second</text>

  ${footnote(80, 636, `The shelf is the six newest tools, and it sits above the catalog. Before, it inherited its cards' catalog positions and finished at ${(OLD_RAIL_LAST / 1000).toFixed(2)}s.`)}
  ${footnote(80, 662, `Delays computed from entrance.js (${T.step}ms x ${T.cap} max) and recent.js (${T.echoStep}ms x ${T.railSize}), not measured.`)}
  `);
}

/* ── 11 — how the shelf inherited a delay it never asked for ───── */
function cloneLeak() {
  const W = 1200, H = 620;
  const box = (x, y, w, h, stroke, fillOp = '.04') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${INK}" fill-opacity="${fillOp}" stroke="${stroke}" stroke-width="1.5"/>`;

  const late = OLD_RAIL_LAST;

  return frame(W, H, `
  ${heading(80, 84, 'the leak', 'A style that travelled', 'cloneNode copies inline styles. That is the whole bug.')}

  ${box(80, 210, 320, 150, LINE)}
  <text x="104" y="248" fill="${MUTE}" font-size="17" font-weight="700" letter-spacing="1.6">CATALOG CARD</text>
  <text x="104" y="286" fill="${INK}" font-size="21">entrance.js writes</text>
  <text x="104" y="320" fill="${ACCENT}" font-size="23" font-weight="700" font-family="monospace">animation-delay: ${late}ms</text>
  <text x="104" y="346" fill="${MUTE}" font-size="17">inline, on the element</text>

  <line x1="410" y1="285" x2="490" y2="285" stroke="${LINE}" stroke-width="2"/>
  <path d="M490 285 l-12 -6 v12 z" fill="${LINE}"/>
  <text x="450" y="268" text-anchor="middle" fill="${MUTE}" font-size="17" font-family="monospace">clone</text>

  ${box(500, 210, 620, 150, ACCENT, '.06')}
  <text x="524" y="248" fill="${MUTE}" font-size="17" font-weight="700" letter-spacing="1.6">THE SAME CARD, ON THE NEW SHELF</text>
  <text x="524" y="288" fill="${MUTE}" font-size="20" font-family="monospace" text-decoration="line-through">animation-delay: var(--echo-delay)</text>
  <text x="524" y="322" fill="${ACCENT}" font-size="23" font-weight="700" font-family="monospace">animation-delay: ${late}ms</text>
  <text x="524" y="348" fill="${MUTE}" font-size="17">inline beats the stylesheet, every time</text>

  <text x="80" y="440" fill="${INK}" font-size="24" font-weight="600">The shelf declared its timing in CSS. The clone arrived carrying someone else's.</text>
  <text x="80" y="482" fill="${DIM}" font-size="21">The stylesheet was never wrong. It just never got a turn.</text>

  ${box(80, 512, 1040, 62, LINE)}
  <text x="104" y="551" fill="${DIM}" font-size="21" font-family="monospace">echo.style.animationDelay = '';   // drop what came with the clone</text>
  `);
}

/* ── 12 — the badge that stopped meaning anything ──────────────── */
function badgeInflation() {
  const W = 1200, H = 560;
  const cols = 11, cell = 46, gx = 300, gy = 230;
  const freshIds = new Set(FRESH.map((c) => c.id));
  const railIds = new Set(RAIL.map((c) => c.id));

  const dots = LIVE.map((c, i) => {
    const cx = gx + (i % cols) * cell;
    const cy = gy + Math.floor(i / cols) * cell;
    const isFresh = freshIds.has(c.id);
    const isRail = railIds.has(c.id);
    return `<circle cx="${cx}" cy="${cy}" r="${isFresh ? 13 : 9}"
      fill="${isFresh ? ACCENT : 'rgba(255,255,255,.14)'}" fill-opacity="${isFresh ? '.92' : '1'}"/>
    ${isRail ? `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="${INK}" stroke-width="2"/>` : ''}`;
  }).join('');

  return frame(W, H, `
  ${heading(80, 84, 'still open', 'A badge on a third of the catalog',
    `${LIVE.length} live tools. ${FRESH.length} of them are wearing a New badge.`)}

  ${dots}

  <text x="${gx - 40}" y="${gy + 6}" text-anchor="end" fill="${MUTE}" font-size="19">every live tool</text>

  ${legend(300, 424, [
    { fill: ACCENT, text: `badged New (${FRESH.length})` },
    { fill: 'rgba(255,255,255,.14)', text: `not badged (${LIVE.length - FRESH.length})` },
  ])}
  <circle cx="812" cy="433" r="11" fill="none" stroke="${INK}" stroke-width="2"/>
  <text x="832" y="439" fill="${MUTE}" font-size="18">also on the shelf (${RAIL.length})</text>

  ${footnote(80, 500, `NEW_DAYS is ${T.newDays} and RAIL_SIZE is ${T.railSize}, both read from recent.js. At the current rate those two numbers describe different things.`)}
  `);
}

/* ── write ─────────────────────────────────────────────────────── */
emit({
  '10-entrance-timeline.svg': entranceTimeline(),
  '11-clone-leak.svg': cloneLeak(),
  '12-badge-inflation.svg': badgeInflation(),
}, HERE, { writeFileSync, join });

console.log(`
  cards in #tools     ${CARDS.length}   (${LIVE.length} live, ${SOON.length} soon, ${EXTERNAL.length} external)
  entrance worst      ${OLD_WORST}ms -> ${NEW_WORST}ms
  shelf finished at   ${OLD_RAIL_LAST}ms -> ${NEW_RAIL_LAST}ms
  New badges          ${FRESH.length} of ${LIVE.length} live
  shelf holds         ${RAIL.length}`);
