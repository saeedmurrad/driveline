/**
 * Keeps only real photos of each vehicle in src/app/data/vehicles.data.ts.
 *
 * The source dealer pads galleries with marketing banners ("Nationwide delivery",
 * "We buy cars too", review badges, logo cards, "awaiting preparation" placeholders).
 * An image is dropped when its MD5 is on the blocklist, or when the identical file
 * appears on more than one vehicle (a real photo belongs to exactly one car).
 * Vehicles left without photos get `photosPending: true` and show a branded
 * "photos coming soon" panel instead. Featured slots go to the newest cars with photos.
 *
 * Files in public/stock/fengate that no vehicle uses any more (the dropped banners)
 * are deleted, so they are not published with the site.
 *
 * Usage: node scripts/filter-stock-images.mjs   (runs after `npm run sync:stock`)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/app/data/vehicles.data.ts');
const PUBLIC = join(ROOT, 'public');
const blocked = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts/stock-image-blocklist.json'), 'utf8')).md5);

const START = 'export const VEHICLES: Vehicle[] = ';
const src = readFileSync(DATA, 'utf8');
const a = src.indexOf(START) + START.length;
const b = src.indexOf('];', a) + 1;
const vehicles = JSON.parse(src.slice(a, b));

const md5 = (rel) => {
  const p = join(PUBLIC, rel);
  return existsSync(p) ? createHash('md5').update(readFileSync(p)).digest('hex') : null;
};

// Which vehicles use each image hash
const owners = new Map();
const hashOf = new Map();
for (const v of vehicles) {
  for (const img of v.images ?? []) {
    if (/^https?:/.test(img)) continue;
    const h = md5(img);
    hashOf.set(img, h);
    if (!h) continue;
    if (!owners.has(h)) owners.set(h, new Set());
    owners.get(h).add(v.id);
  }
}

let dropped = 0;
for (const v of vehicles) {
  const before = v.images ?? [];
  const real = before.filter((img) => {
    if (/^https?:/.test(img)) return true;
    const h = hashOf.get(img);
    if (!h) return false;
    return !blocked.has(h) && owners.get(h).size === 1;
  });
  dropped += before.length - real.length;
  v.images = real;
  v.thumbnailImage = real[0] ?? '';
  if (real.length) delete v.photosPending;
  else v.photosPending = true;
}

// Featured: newest six on sale that have real photos
vehicles.sort((x, y) => new Date(y.dateAdded).getTime() - new Date(x.dateAdded).getTime());
let featured = 0;
for (const v of vehicles) {
  v.isFeatured = !v.photosPending && v.status !== 'sold' && featured < 6;
  if (v.isFeatured) featured++;
}

writeFileSync(DATA, src.slice(0, a) + JSON.stringify(vehicles, null, 2) + src.slice(b), 'utf8');
const pending = vehicles.filter((v) => v.photosPending).map((v) => v.id);
console.log(`Removed ${dropped} non-photo images. ${pending.length} vehicles awaiting photos: ${pending.join(', ') || 'none'}`);

// Delete stock image files that no vehicle references.
const STOCK_DIR = join(PUBLIC, 'stock/fengate');
const used = new Set(vehicles.flatMap((v) => v.images ?? []).filter((p) => !/^https?:/.test(p)));
let removed = 0;
if (existsSync(STOCK_DIR)) {
  for (const f of readdirSync(STOCK_DIR)) {
    if (!used.has(`stock/fengate/${f}`)) {
      unlinkSync(join(STOCK_DIR, f));
      removed++;
    }
  }
}
console.log(`Deleted ${removed} unused image files from public/stock/fengate.`);
