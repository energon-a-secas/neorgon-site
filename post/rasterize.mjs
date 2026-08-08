// ── SVG → PNG ────────────────────────────────────────────────
// Medium, LinkedIn and most newsletters reject SVG. Renders every
// diagram at 2x and flattens it onto the site background, because
// those platforms composite on white and a transparent dark diagram
// picks up light halos around its edges.
//
// Files named *-bare.svg keep their alpha instead, for compositing
// into another image.
//
// Run from the project root: node post/rasterize.mjs

import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// sharp lives in the monorepo root's node_modules, not per project.
const require = createRequire(process.env.SHARP_FROM || `${process.cwd()}/`);
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp not found. Run from the monorepo root, or set SHARP_FROM=/path/to/dir/with/node_modules/');
  process.exit(1);
}

const OUT = dirname(fileURLToPath(import.meta.url));
const PNG_DIR = join(OUT, 'png');
mkdirSync(PNG_DIR, { recursive: true });

const SCALE = Number(process.env.SCALE || 2);
const BG = { r: 4, g: 7, b: 20, alpha: 1 };

const files = readdirSync(OUT).filter((f) => f.endsWith('.svg')).sort();
if (files.length === 0) {
  console.error(`no .svg files in ${OUT} — run the generator first`);
  process.exit(1);
}

for (const name of files) {
  const svg = readFileSync(join(OUT, name));
  const m = svg.toString().match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  if (!m) {
    console.error(`skipped ${name}: no integer viewBox to size from`);
    continue;
  }
  const [, w, h] = m.map(Number);
  const target = join(PNG_DIR, name.replace(/\.svg$/, '.png'));
  const keepAlpha = name.includes('-bare');

  let img = sharp(svg, { density: 72 * SCALE })
    .resize(Math.round(w * SCALE), Math.round(h * SCALE), { fit: 'fill' });
  if (!keepAlpha) img = img.flatten({ background: BG });

  await img.png({ compressionLevel: 9 }).toFile(target);

  console.log(
    `${name} → png/${name.replace(/\.svg$/, '.png')}  ${Math.round(w * SCALE)}×${Math.round(h * SCALE)}`
    + (keepAlpha ? '  (transparent)' : ''),
  );
}
