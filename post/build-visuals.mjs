// ── Diagrams for the neorgon-site hub post ───────────────────
// Run from the monorepo root:
//   node neorgon-site/post/build-visuals.mjs && node neorgon-site/post/rasterize.mjs
//
// This hub has no js/data.js to import — its model *is* the DOM. So the
// numbers come from three readers, and every one of them throws if what
// it is looking for has moved:
//
//   readCatalog()  — index.html: sections, cards, ship dates
//   readConstants() — js/recent.js + js/catnav.js: RAIL_SIZE, NEW_DAYS,
//                     the anchor pad, the reading-line pad
//   measured()     — .forge/brief.md's `## Measured` table, which is the
//                     only source for a before/after that was read out of
//                     a live browser and cannot be recomputed
//
// Nothing below is typed in by hand except labels. A diagram that
// disagrees with the page is therefore a crash, not a quiet lie.

import { readFileSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  frame, heading, footnote, legend, emit,
  BG, INK, DIM, MUTE, LINE, ACCENT, esc,
} from './diagram-kit.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..');
const read = (p) => readFileSync(join(SITE, p), 'utf8');

/* The post is about a moment, so "today" has to be the day the work
   landed rather than the day someone rebuilds the diagrams — otherwise
   the fresh-tool count decays and the prose stops matching the picture. */
const AS_OF = Date.UTC(2026, 7, 8);
const DAY = 86400000;

/* ── Reader 1: the catalog, straight out of the page ──────────── */
function readCatalog() {
  const html = read('index.html');
  const chunks = html.split(/<div[^>]*class="card-group[^"]*"[^>]*id="(group-[a-z-]+)"/);
  if (chunks.length < 3) throw new Error('index.html: no .card-group sections matched, did the markup change?');

  const groups = [];
  for (let i = 1; i < chunks.length; i += 2) {
    const id = chunks[i];
    const body = chunks[i + 1];
    const raw = (body.match(/class="group-label"[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
    if (!raw) throw new Error(`${id}: no .group-label heading found`);
    const label = raw.replace(/<[^>]*>/g, '').trim();
    const dates = [...body.matchAll(/data-added="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    const cards = [...body.matchAll(/data-card-id="([a-z0-9-]+)"/g)].map((m) => m[1]);
    groups.push({ id, label, cards: cards.length, dates });
  }
  return groups;
}

const ageDays = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return (AS_OF - Date.UTC(y, m - 1, d)) / DAY;
};

/* ── Reader 2: the two constants that decide what "new" means ──── */
function readConstants() {
  const recent = read('js/recent.js');
  const catnav = read('js/catnav.js');
  const one = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`could not read ${what}: the constant moved`);
    return Number(m[1]);
  };
  return {
    railSize: one(recent, /var RAIL_SIZE = (\d+)/, 'RAIL_SIZE from recent.js'),
    newDays: one(recent, /var NEW_DAYS = (\d+)/, 'NEW_DAYS from recent.js'),
    anchorPad: one(catnav, /offsetHeight : 0\) \+ (\d+);/, 'the anchor pad from catnav.js'),
    linePad: one(catnav, /return anchorOffset\(\) \+ (\d+);/, 'the reading-line pad from catnav.js'),
  };
}

/* ── Reader 3: the brief's measured table ─────────────────────── */
// Figures read out of a live page with browser_evaluate. They are
// observations, not functions, so the brief is their model: change a
// row there and the diagram follows.
const BRIEF = read('.forge/brief.md');

function measured(rowKeyword) {
  const line = BRIEF.split('\n').find(
    (l) => l.startsWith('|') && l.includes(rowKeyword) && !l.includes('---'),
  );
  if (!line) throw new Error(`brief.md: no Measured row matching "${rowKeyword}"`);
  const cells = line.split('|').map((c) => c.trim());
  return { before: cells[2], after: cells[3], how: cells[4] };
}

function pick(cell, re, label) {
  const m = cell.match(re);
  if (!m) throw new Error(`could not pull ${label} out of "${cell}"`);
  return m[1];
}

/* Greedy word wrap. Widths are estimated from the character count because
   there is no text metric available in a plain SVG writer — erring narrow
   is the safe direction, since a too-early break looks tidy and an
   overflow runs off the canvas. */
function wrap(text, maxChars) {
  const out = [];
  let line = '';
  for (const word of String(text).split(' ')) {
    if (line && (line + ' ' + word).length > maxChars) { out.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(line);
  return out;
}

const CATALOG = readCatalog();
const K = readConstants();

const ALL_DATES = CATALOG.flatMap((g) => g.dates);
const TOTAL_CARDS = CATALOG.reduce((n, g) => n + g.cards, 0);
const FRESH = ALL_DATES.filter((d) => ageDays(d) <= K.newDays).length;
const withFresh = CATALOG.filter((g) => g.dates.some((d) => ageDays(d) <= K.newDays));

/* ── 01 — where the new tools actually were ───────────────────── */
function recencyMap() {
  const W = 1200, H = 300 + CATALOG.length * 46;
  const x = 300, barW = 640;
  const maxCards = Math.max(...CATALOG.map((g) => g.cards));
  let y = 214;

  const rows = CATALOG.map((g) => {
    const fresh = g.dates.filter((d) => ageDays(d) <= K.newDays).length;
    const full = (g.cards / maxCards) * barW;
    const hot = (fresh / maxCards) * barW;
    const row = `
    <text x="${x - 26}" y="${y + 25}" text-anchor="end" fill="${fresh ? INK : MUTE}" font-size="22" font-weight="${fresh ? 600 : 400}">${esc(g.label)}</text>
    <rect x="${x}" y="${y + 6}" width="${full.toFixed(1)}" height="28" rx="6" fill="rgba(255,255,255,.07)"/>
    ${fresh ? `<rect x="${x}" y="${y + 6}" width="${hot.toFixed(1)}" height="28" rx="6" fill="${ACCENT}" fill-opacity=".92"/>` : ''}
    <text x="${x + full + 20}" y="${y + 27}" fill="${fresh ? ACCENT : MUTE}" font-size="20" font-weight="${fresh ? 700 : 400}">${fresh ? `${fresh} new` : '-'}</text>`;
    y += 46;
    return row;
  }).join('');

  return frame(W, H, `
  ${heading(64, 88, 'recency', `${FRESH} new tools, spread across ${withFresh.length} of ${CATALOG.length} sections`, `${TOTAL_CARDS} cards in the catalog · nothing on the page said which were new`)}
  ${rows}
  ${legend(300, y + 6, [
    { fill: ACCENT, text: `shipped in the last ${K.newDays} days` },
    { fill: 'rgba(255,255,255,.07)', text: 'everything else' },
  ])}
  ${footnote(64, H - 44, `Read from data-added on every card in index.html. Bar length is section size; the largest is ${maxCards} cards.`)}`);
}

/* ── 02 — one measurement, three consumers ───────────────────── */
function offsetChain() {
  const W = 1200;
  const rail = Number(pick(measured('Rail sliding under the header').before, /top: (\d+)px/, 'the old rail top'));
  const header = Number(pick(measured('Rail sliding under the header').before, /vs (\d+)px header/, 'the header height'));
  const landing = Number(pick(measured('Deep link').after, /top: (\d+)/, 'the landed heading position'));
  const wasAt = Number(pick(measured('Deep link').before, /top: (\d+)/, 'the old heading position'));
  const overlap = Number(pick(measured('Rail sliding under the header').before, /^(\d+)px/, 'the old overlap'));

  const sum = rail + header + K.anchorPad;
  if (sum !== landing) {
    throw new Error(`anchorOffset() should equal the measured landing: ${rail}+${header}+${K.anchorPad}=${sum}, brief says ${landing}`);
  }

  const bx = 74, bh = 132, bw = 330;
  /* Box geometry is derived rather than fixed: the grey "before" line is the
     longest text on the canvas, so each box has to be as tall as its wrapped
     form, and the canvas has to be as tall as the resulting stack. */
  const cx = 600;
  const cw = W - cx - 64;
  const WRAP_AT = 62;

  const consumers = [
    {
      name: 'scroll-margin-top', on: 'on every .card-group',
      was: `was a JS scroll fix, overwritten by Chrome's own re-jump. The heading sat at top: ${wasAt}`,
    },
    {
      name: '--cat-rail-top', on: "the rail's own sticky top",
      was: `was hardcoded ${rail}px under a ${header}px header, hiding ${overlap}px of the rail`,
    },
    {
      name: `readingLine()  (+${K.linePad})`, on: 'which chip lights up',
      was: 'was computed apart and 8px adrift: lit the section above the one you jumped to',
    },
  ];

  const laid = consumers.map((c) => {
    const lines = wrap(c.was, WRAP_AT);
    return { ...c, lines, h: 82 + lines.length * 26 };
  });

  const GAP = 34;
  const TOP = 208;
  const stackH = laid.reduce((n, c) => n + c.h, 0) + GAP * (laid.length - 1);
  const H = TOP + stackH + 132;
  /* The left-hand box is vertically centred against the stack it feeds. */
  const by = TOP + stackH / 2 - bh / 2;
  let cursor = TOP;

  const boxes = laid.map((c) => {
    const y = cursor;
    cursor += c.h + GAP;
    const midY = y + c.h / 2;
    const startX = bx + bw, startY = by + bh / 2;
    const greyLines = c.lines.map((l, j) =>
      `<text x="${cx + 26}" y="${y + 92 + j * 26}" fill="${MUTE}" font-size="17">${esc(l)}</text>`).join('');
    return `
    <path d="M ${startX} ${startY} C ${startX + 110} ${startY}, ${cx - 110} ${midY}, ${cx - 14} ${midY}" fill="none" stroke="${ACCENT}" stroke-opacity=".5" stroke-width="2"/>
    <circle cx="${cx - 14}" cy="${midY}" r="4" fill="${ACCENT}"/>
    <rect x="${cx}" y="${y}" width="${cw}" height="${c.h}" rx="12" fill="rgba(255,255,255,.04)" stroke="${LINE}"/>
    <text x="${cx + 26}" y="${y + 40}" fill="${INK}" font-size="23" font-weight="700" font-family="ui-monospace,Menlo,monospace">${esc(c.name)}</text>
    <text x="${cx + 26}" y="${y + 68}" fill="${DIM}" font-size="19">${esc(c.on)}</text>
    ${greyLines}`;
  }).join('');


  return frame(W, H, `
  ${heading(64, 88, 'one owner', 'Three things need the same number', 'Each computed it separately. All three were wrong in a different way.')}
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="14" fill="rgba(176,21,176,.14)" stroke="${ACCENT}" stroke-opacity=".55" stroke-width="2"/>
  <text x="${bx + 26}" y="${by + 46}" fill="${INK}" font-size="25" font-weight="700" font-family="ui-monospace,Menlo,monospace">anchorOffset()</text>
  <text x="${bx + 26}" y="${by + 80}" fill="${DIM}" font-size="19">rail ${rail} + header ${header} + ${K.anchorPad}</text>
  <text x="${bx + 26}" y="${by + 112}" fill="${ACCENT}" font-size="28" font-weight="700">= ${landing}px</text>
  <text x="${bx + 26}" y="${by - 26}" fill="${MUTE}" font-size="18" letter-spacing="2">MEASURED ONCE, LIVE</text>
  ${boxes}
  ${footnote(64, H - 62, 'Grey text is what each consumer did before it derived from the same function.')}
  ${footnote(64, H - 34, `Verified by navigating to #group-health: the heading now lands at ${landing}px with the right chip lit.`)}`);
}

/* ── 03 — the rail on a phone ─────────────────────────────────── */
function phoneRail() {
  const row = measured('Recent rail height on a');
  const label = BRIEF.split('\n').find((l) => l.includes('Recent rail height on a')).split('|')[1].trim();
  const screen = Number(pick(label, /×(\d+) phone/, 'the phone viewport height'));
  const before = Number(pick(row.before, /^(\d+)px/, 'the old rail height'));
  const after = Number(pick(row.after, /^(\d+)px/, 'the new rail height'));
  const catBefore = Number(pick(row.before, /y=(\d+)/, 'where the catalog used to start'));
  const catAfter = Number(pick(row.after, /y=(\d+)/, 'where the catalog starts now'));

  const W = 1200, H = 620;
  const x = 300, barW = 700;
  const scale = barW / (before * 1.06);
  const wall = x + screen * scale;

  /* Figures sit in one column past the longest bar rather than tracking each
     bar's end — the "after" bar is short enough that a bar-relative label
     collided with the caption inside it. */
  const figX = x + before * scale + 24;

  const bar = (y, val, cat, tone, tag) => {
    const barW2 = val * scale;
    /* The caption goes inside the bar when it fits and underneath when it
       does not, which is the whole point of the "after" case being short. */
    const inside = barW2 > 300;
    return `
    <text x="${x - 26}" y="${y + 42}" text-anchor="end" fill="${INK}" font-size="24" font-weight="600">${esc(tag)}</text>
    <rect x="${x}" y="${y}" width="${barW2.toFixed(1)}" height="64" rx="9" fill="${tone}" fill-opacity="${tone === ACCENT ? '.9' : '.28'}"/>
    <text x="${inside ? x + 18 : x}" y="${inside ? y + 41 : y + 94}" fill="${INK}" font-size="19" fill-opacity="${inside ? '.8' : '.62'}">catalog starts at y=${cat}</text>
    <text x="${figX}" y="${y + 32}" fill="${INK}" font-size="25" font-weight="700">${val}px</text>
    <text x="${figX}" y="${y + 58}" fill="${MUTE}" font-size="18">${(val / screen).toFixed(2)} screens</text>`;
  };

  return frame(W, H, `
  ${heading(64, 88, 'mobile', `${K.railSize} cards, one column, two screens of scroll`, `On a ${label.match(/(\d+×\d+)/)[1]} phone the rail buried the thing it introduces.`)}
  <rect x="${wall - 2}" y="196" width="4" height="290" rx="2" fill="${INK}"/>
  <text x="${wall + 14}" y="188" fill="${MUTE}" font-size="18" font-weight="700">ONE SCREEN (${screen}px)</text>
  ${bar(212, before, catBefore, INK, 'Before')}
  ${bar(352, after, catAfter, ACCENT, 'After')}
  ${footnote(64, H - 96, `Same ${K.railSize} cards. Below 600px the grid becomes a snap-scrolling row: first card full, second peeking.`)}
  ${footnote(64, H - 66, `The catalog moved up ${catBefore - catAfter}px — from below the fold to inside the first screen and a bit.`)}
  ${footnote(64, H - 36, 'Measured with getBoundingClientRect().height / innerHeight on a live page.')}`);
}

/* ── 04 — the numbers the page disagreed with itself about ─────── */
function ledger() {
  const rows = [
    { row: 'Hero tool count', label: 'Tools the page claimed', before: /(\d+)/, after: /(\d+)/ },
    { row: '`New` badges on the page', label: 'New badges rendered', before: /^(\d+)/, after: /^(\d+)/ },
    { row: 'Categories reachable by pill', label: 'Pills pointing at a real section', before: /(\d+ of \d+)/, after: /(\d+\/\d+)/ },
    { row: 'Cards reachable by pill', label: 'Cards no pill could reach', before: /^(\d+)/, after: /^(\d+)/ },
    { row: 'Footers rendered', label: 'Footers on the page', before: /^(\d+)/, after: /^(\d+)/ },
    { row: 'Console errors on load', label: 'Console errors on load', before: /^(\d+)/, after: /^(\d+)/ },
  ].map((spec) => {
    const m = measured(spec.row);
    return {
      label: spec.label,
      before: pick(m.before, spec.before, `${spec.row} before`).replace(' of ', '/'),
      after: pick(m.after, spec.after, `${spec.row} after`).replace(' of ', '/'),
    };
  });

  const W = 1200, H = 260 + rows.length * 78;
  const lx = 74, bxc = 720, axc = 1010;
  let y = 224;

  const body = rows.map((r) => {
    const line = `
    <text x="${lx}" y="${y}" fill="${DIM}" font-size="23">${esc(r.label)}</text>
    <text x="${bxc}" y="${y + 4}" text-anchor="middle" fill="${MUTE}" font-size="34" font-weight="700">${esc(r.before)}</text>
    <line x1="${bxc - 46}" y1="${y - 8}" x2="${bxc + 46}" y2="${y - 8}" stroke="${MUTE}" stroke-width="0"/>
    <path d="M ${bxc + 74} ${y - 9} H ${axc - 82}" stroke="${LINE}" stroke-width="2"/>
    <path d="M ${axc - 88} ${y - 15} l 8 6 l -8 6 z" fill="${LINE}"/>
    <text x="${axc}" y="${y + 4}" text-anchor="middle" fill="${ACCENT}" font-size="34" font-weight="700">${esc(r.after)}</text>
    <path d="M ${lx} ${y + 30} H ${W - 74}" stroke="rgba(255,255,255,.07)" stroke-width="1"/>`;
    y += 78;
    return line;
  }).join('');

  return frame(W, H, `
  ${heading(64, 88, 'bookkeeping', 'What the page said about itself', 'None of these were the feature. All of them were visible.')}
  <text x="${bxc}" y="182" text-anchor="middle" fill="${MUTE}" font-size="18" letter-spacing="2.6">BEFORE</text>
  <text x="${axc}" y="182" text-anchor="middle" fill="${ACCENT}" font-size="18" letter-spacing="2.6">AFTER</text>
  ${body}
  ${footnote(64, H - 48, 'Every figure counted in a live page, not estimated. Source rows in .forge/brief.md.')}`);
}

emit({
  '01-recency-map.svg': recencyMap(),
  '02-one-offset.svg': offsetChain(),
  '03-phone-rail.svg': phoneRail(),
  '04-bookkeeping.svg': ledger(),
}, HERE, { writeFileSync, join });

console.log(`\nmodel: ${TOTAL_CARDS} cards, ${CATALOG.length} sections, ${FRESH} within ${K.newDays} days, rail shows ${K.railSize}`);
