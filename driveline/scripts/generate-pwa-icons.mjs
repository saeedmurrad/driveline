/**
 * Makes the "maskable" app icons from the DriveLine mark (public/brand/driveline-mark.svg).
 *
 * Android cuts home-screen icons into its own shape (circle, squircle...), so a maskable icon
 * needs the artwork inside the middle 80% and the background running to every edge. The
 * normal icons (icon-192.png / icon-512.png) stay as they are for everything else.
 *
 *   node scripts/generate-pwa-icons.mjs      (run again whenever the mark changes)
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'brand');
const mark = readFileSync(join(BRAND, 'driveline-mark.svg'), 'utf8');

const defs = /<defs>[\s\S]*<\/defs>/.exec(mark)?.[0];
if (!defs) throw new Error('driveline-mark.svg has no <defs> block');
// Everything after the rounded background tiles: the D, the road and its markings.
const art = mark.slice(mark.indexOf('</defs>') + 7).replace(/<rect[^>]*\/>/g, '').replace('</svg>', '');
const SCALE = 0.8; // the D spans 23%..78% of the tile; at 0.8 it sits well inside the safe circle

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${defs}
  <rect width="64" height="64" fill="url(#dl-bg)"/>
  <rect width="64" height="64" fill="url(#dl-glow)"/>
  <g transform="translate(32 32) scale(${SCALE}) translate(-32 -32)">${art}</g>
</svg>`;

for (const size of [192, 512]) {
  const file = join(BRAND, `icon-maskable-${size}.png`);
  await sharp(Buffer.from(svg), { density: 72 * (size / 64) * 2 })
    .resize(size, size)
    .flatten({ background: '#16050a' })
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${file}`);
}
