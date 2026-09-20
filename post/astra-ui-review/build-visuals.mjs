// Real browser captures are the source: no reconstructed UI or invented metrics.
// Run from neorgon-site: node post/astra-ui-review/build-visuals.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { frame, heading, esc, INK, DIM } from '../diagram-kit.mjs';
const here = new URL('./', import.meta.url);
const shots = new URL('../../docs/debrief-2026-09-20-img/', here);
const panels = [
  { file: 'before-antenne.png', label: 'Before', x: 96 },
  { file: 'after-antenne.png', label: 'After', x: 780 }
];
let body = heading(64, 60, 'Neorgon / UI field notes', 'Antenne finds its place in the catalog', 'The same published stories, rendered with local tool artwork.');
for (const panel of panels) {
  const bytes = readFileSync(new URL(panel.file, shots));
  body += `<text x="${panel.x}" y="224" fill="${INK}" font-size="25" font-weight="600">${esc(panel.label)}</text>`;
  body += `<image x="${panel.x}" y="248" width="560" height="590" preserveAspectRatio="xMinYMin meet" href="data:image/png;base64,${bytes.toString('base64')}"/>`;
}
body += `<text x="64" y="878" fill="${DIM}" font-size="19">Local browser captures · September 20, 2026 · Static icons with update-type badges</text>`;
const svg = frame(1440, 920, body, { glow: false });
writeFileSync(new URL('01-antenne-comparison.svg', here), svg);
await sharp(Buffer.from(svg), { density: 144 }).flatten({ background: '#040714' }).png().toFile(fileURLToPath(new URL('png/01-antenne-comparison.png', here)));
console.log('Built comparison SVG and 2x PNG from the captured UI.');
