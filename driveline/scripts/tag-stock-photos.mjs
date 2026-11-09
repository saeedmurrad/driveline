/**
 * Sorts every stock photo into exterior / interior / detail so the vehicle gallery
 * can offer "Exterior", "Interior" and "Details" tabs.
 *
 * Uses Apple's on-device Vision classifier (scripts/classify-photos.swift), so it
 * needs macOS with Xcode command line tools. Elsewhere it leaves the data alone and
 * the gallery simply shows all photos without tabs.
 *
 * Writes `imageTags` on each vehicle in vehicles.data.ts: one letter per photo, in the
 * same order as `images` (e = exterior, i = interior, d = detail).
 * Usage: node scripts/tag-stock-photos.mjs   (part of `npm run sync:stock`)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/app/data/vehicles.data.ts');
const PUBLIC = join(ROOT, 'public');
const SWIFT = join(ROOT, 'scripts/classify-photos.swift');
const BIN_DIR = join(ROOT, 'node_modules/.cache/driveline');
const BIN = join(BIN_DIR, 'classify-photos');
const START = 'export const VEHICLES: Vehicle[] = ';

/** Labels from Apple's taxonomy that mean "inside the car" / "the car from outside". */
const INSIDE = ['dashboard', 'seat', 'car_seat', 'tachometer', 'dial', 'keypad', 'speakers_music', 'stereo', 'consumer_electronics', 'map', 'screenshot', 'furniture'];
const OUTSIDE = ['automobile', 'vehicle', 'car', 'suv', 'van', 'truck', 'sportscar', 'sky', 'outdoor', 'parking_lot', 'license_plate', 'wheel', 'tire', 'rim', 'land'];

export function photoTag(labels) {
  const score = (keys) => Math.max(0, ...keys.map((k) => labels[k] ?? 0));
  const inside = score(INSIDE);
  const outside = score(OUTSIDE);
  if (inside >= 0.25 && inside >= outside - 0.05) return 'interior';
  if (outside >= 0.3) return 'exterior';
  if (inside >= 0.25) return 'interior';
  return 'detail';
}

function classifier() {
  if (process.platform !== 'darwin') return null;
  try {
    if (!existsSync(BIN) || statSync(BIN).mtimeMs < statSync(SWIFT).mtimeMs) {
      mkdirSync(BIN_DIR, { recursive: true });
      execFileSync('swiftc', ['-O', '-o', BIN, SWIFT], { stdio: 'inherit' });
    }
    return BIN;
  } catch (e) {
    console.warn('Photo tagging skipped (could not build the Vision classifier):', e.message);
    return null;
  }
}

const bin = classifier();
if (!bin) process.exit(0);

const src = readFileSync(DATA, 'utf8');
const a = src.indexOf(START) + START.length;
const b = src.indexOf('];', a) + 1;
const vehicles = JSON.parse(src.slice(a, b));

const files = [...new Set(vehicles.flatMap((v) => v.images ?? []).filter((p) => !/^https?:/.test(p)))];
const labels = {};
for (let i = 0; i < files.length; i += 200) {
  const batch = files.slice(i, i + 200).map((f) => join(PUBLIC, f)).filter(existsSync);
  Object.assign(labels, JSON.parse(execFileSync(bin, batch, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })));
}

const counts = { exterior: 0, interior: 0, detail: 0 };
for (const v of vehicles) {
  if (!v.images?.length) {
    delete v.imageTags;
    continue;
  }
  v.imageTags = v.images
    .map((img) => {
      const tag = photoTag(labels[basename(img)] ?? {});
      counts[tag]++;
      return tag[0]; // e / i / d
    })
    .join('');
}

writeFileSync(DATA, src.slice(0, a) + JSON.stringify(vehicles, null, 2) + src.slice(b), 'utf8');
console.log(`Tagged photos: ${counts.exterior} exterior, ${counts.interior} interior, ${counts.detail} detail.`);
