/**
 * One share image per vehicle (1200×630, what WhatsApp / Facebook / X show when a car's
 * link is shared): the car's main photo with its price, mileage, fuel, gearbox and the
 * DriveLine logo. Reduced and sold cars are marked.
 *
 * Writes public/og/{id}.jpg (only when the car's details or photo changed) and removes
 * images for cars no longer on the site. Runs in `npm run sync:stock`.
 * Usage: node scripts/generate-share-images.mjs
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const OUT_DIR = join(PUBLIC, 'og');
const START = 'export const VEHICLES: Vehicle[] = ';
const W = 1200;
const H = 630;
const PHOTO_W = 740;
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const src = readFileSync(join(ROOT, 'src/app/data/vehicles.data.ts'), 'utf8');
const a = src.indexOf(START) + START.length;
const vehicles = JSON.parse(src.slice(a, src.indexOf('];', a) + 1));
const logo = readFileSync(join(PUBLIC, 'brand/driveline-mark.svg'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');

/** Greedy word wrap by an approximate character budget. */
function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = (line + ' ' + w).trim();
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(' ').split(/\s+/).length;
  if (used < words.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '') + '…';
  return lines;
}

function panelSvg(v) {
  const reduced = v.previousPrice && v.previousPrice > v.price && v.status !== 'sold';
  const title = wrap(`${v.year} ${v.make} ${v.model}`, 17, 2);
  const deriv = wrap(v.derivative, 32, 2);
  const specs = [`${Math.round(v.mileage).toLocaleString('en-GB')} miles`, v.fuelType, v.transmission].filter(Boolean).join('  ·  ');
  let y = 190;
  const titleSvg = title.map((l, i) => `<text x="40" y="${y + i * 46}" font-size="40" font-weight="700" fill="#ffffff">${esc(l)}</text>`).join('');
  y += title.length * 46 + 6;
  const derivSvg = deriv.map((l, i) => `<text x="40" y="${y + i * 28}" font-size="21" fill="#fecdd3" opacity="0.9">${esc(l)}</text>`).join('');
  y += deriv.length * 28 + 70;
  const priceLabel = v.status === 'sold' ? 'Last advertised' : reduced ? `Was ${gbp(v.previousPrice)}` : 'Cash price';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W - PHOTO_W}" height="${H}" font-family="${FONT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a0f1f"/><stop offset="1" stop-color="#16050a"/></linearGradient>
      <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e11d48"/><stop offset=".6" stop-color="#fb7185"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="112" y="80" font-size="30" font-weight="700" fill="#ffffff">DriveLine</text>
    <text x="113" y="106" font-size="13" font-weight="700" letter-spacing="3.5" fill="#fb7185">CAR SALES</text>
    ${titleSvg}${derivSvg}
    <text x="40" y="${y - 30}" font-size="17" font-weight="700" letter-spacing="1.5" fill="#fda4af" ${reduced ? 'text-decoration="line-through"' : ''}>${esc(priceLabel.toUpperCase())}</text>
    <text x="40" y="${y + 30}" font-size="64" font-weight="800" fill="${reduced ? '#fb7185' : '#ffffff'}">${esc(gbp(v.price))}</text>
    ${reduced ? `<rect x="40" y="${y + 52}" width="${36 + ('REDUCED ' + gbp(v.previousPrice - v.price)).length * 11.6}" height="34" rx="17" fill="#e11d48"/><text x="58" y="${y + 75}" font-size="17" font-weight="700" fill="#fff">REDUCED ${esc(gbp(v.previousPrice - v.price))}</text>` : ''}
    <text x="40" y="${reduced ? y + 128 : y + 82}" font-size="21" fill="#ffffff" opacity="0.92">${esc(specs)}</text>
    <text x="40" y="${H - 42}" font-size="19" font-weight="600" fill="#fda4af">drivelinecarsales.co.uk  ·  Peterborough</text>
    <rect x="0" y="${H - 8}" width="100%" height="8" fill="url(#bar)"/>
  </svg>`;
}

function soldSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PHOTO_W}" height="${H}" font-family="${FONT}">
    <rect width="100%" height="100%" fill="#1c1917" opacity="0.45"/>
    <g transform="translate(${PHOTO_W / 2} ${H / 2}) rotate(-8)">
      <rect x="-150" y="-55" width="300" height="110" rx="14" fill="none" stroke="#fff" stroke-width="6"/>
      <text x="0" y="24" text-anchor="middle" font-size="72" font-weight="800" letter-spacing="10" fill="#fff">SOLD</text>
    </g></svg>`);
}

mkdirSync(OUT_DIR, { recursive: true });
let made = 0;
const keep = new Set();
for (const v of vehicles) {
  const main = v.images?.[0];
  if (!main || /^https?:/.test(main)) continue;
  const hi = main.replace(/\.(jpe?g|png)$/i, '-1600.webp');
  const photoPath = join(PUBLIC, v.mainHiRes && existsSync(join(PUBLIC, hi)) ? hi : main);
  if (!existsSync(photoPath)) continue;
  const out = join(OUT_DIR, `${v.id}.jpg`);
  keep.add(`${v.id}.jpg`);
  // Rebuild only when what is drawn changed.
  const key = createHash('md5').update(JSON.stringify([v.year, v.make, v.model, v.derivative, v.price, v.previousPrice, v.status, v.mileage, v.fuelType, v.transmission, photoPath, statSync(photoPath).mtimeMs, 4])).digest('hex');
  const stamp = out.replace(/\.jpg$/, '.key');
  if (existsSync(out) && existsSync(stamp) && readFileSync(stamp, 'utf8') === key) continue;

  const photo = await sharp(photoPath).resize(PHOTO_W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  const layers = [
    { input: photo, left: 0, top: 0 },
    { input: Buffer.from(panelSvg(v)), left: PHOTO_W, top: 0 },
    { input: await sharp(logo).resize(56, 56).png().toBuffer(), left: PHOTO_W + 40, top: 52 },
  ];
  if (v.status === 'sold') layers.push({ input: soldSvg(), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#16050a' } })
    .composite(layers)
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  writeFileSync(stamp, key);
  made++;
}

// Remove share images for cars that left the site
let removed = 0;
for (const f of readdirSync(OUT_DIR)) {
  const id = f.replace(/\.(jpg|key)$/, '');
  if (!keep.has(`${id}.jpg`)) {
    unlinkSync(join(OUT_DIR, f));
    removed++;
  }
}
console.log(`Share images: ${made} made, ${keep.size} in total, ${removed} old files removed.`);
