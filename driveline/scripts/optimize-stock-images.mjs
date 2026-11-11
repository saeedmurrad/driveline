/**
 * Makes stock photos fast and sharp (runs in `npm run sync:stock`, after the photo filter):
 *
 * - every photo  X.jpg → X-480.webp (cards, thumbnails) and X-800.webp (gallery)
 * - each car's main photo → X-1600.webp from Fengate's high-resolution original, so the big
 *   gallery photo and the share image are crisp on phones (vehicle.mainHiRes = true)
 * - each car's main photo → a tiny blurred preview (vehicle.thumbBlur, ~200 bytes) shown
 *   instantly while the real photo loads
 *
 * Only missing or out-of-date files are made, so re-runs are quick.
 * Usage: node scripts/optimize-stock-images.mjs
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/app/data/vehicles.data.ts');
const PUBLIC = join(ROOT, 'public');
const ORIGIN = 'https://www.fengatecarsales.co.uk';
const UA = 'Mozilla/5.0 (compatible; DriveLineStockSync/1.0; +https://fengatecarsales.co.uk)';
const START = 'export const VEHICLES: Vehicle[] = ';
export const WEBP_SIZES = [480, 800];
const HI_RES = 1600;

const src = readFileSync(DATA, 'utf8');
const a = src.indexOf(START) + START.length;
const b = src.indexOf('];', a) + 1;
const vehicles = JSON.parse(src.slice(a, b));

const fresh = (out, input) => existsSync(out) && statSync(out).mtimeMs >= statSync(input).mtimeMs;
const base = (rel) => rel.replace(/\.(jpe?g|png|webp)$/i, '');
let made = 0;
let hiRes = 0;

for (const v of vehicles) {
  const imgs = (v.images ?? []).filter((p) => !/^https?:/.test(p) && existsSync(join(PUBLIC, p)));
  for (const rel of imgs) {
    const input = join(PUBLIC, rel);
    for (const w of WEBP_SIZES) {
      const out = join(PUBLIC, `${base(rel)}-${w}.webp`);
      if (fresh(out, input)) continue;
      await sharp(input).resize({ width: w, withoutEnlargement: true }).webp({ quality: 78, effort: 5 }).toFile(out);
      made++;
    }
  }

  const main = imgs[0];
  if (!main) {
    delete v.thumbBlur;
    delete v.mainHiRes;
    continue;
  }
  // Tiny blurred preview of the main photo
  const tiny = await sharp(join(PUBLIC, main)).resize(20, 15).webp({ quality: 45 }).toBuffer();
  v.thumbBlur = `data:image/webp;base64,${tiny.toString('base64')}`;

  // High-resolution main photo from Fengate (photo number = the -NN in the file name)
  const hiOut = join(PUBLIC, `${base(main)}-${HI_RES}.webp`);
  if (!existsSync(hiOut)) {
    try {
      const n = Number(/-(\d+)\.[a-z]+$/i.exec(basename(main))?.[1]);
      const api = await (await fetch(`${ORIGIN}/v1/vehicles/stock/${v.id}`, { headers: { 'User-Agent': UA } })).json();
      const img = api.images?.[n - 1];
      const url = img && (img.i1920x1440 || img.full || img.i1128x846);
      if (url) {
        const buf = Buffer.from(await (await fetch(url.startsWith('http') ? url : ORIGIN + url, { headers: { 'User-Agent': UA } })).arrayBuffer());
        // Same photo as our main one? (Fengate can reorder): compare a tiny thumbnail.
        const [x, y] = await Promise.all([sharp(buf).resize(8, 6).raw().toBuffer(), sharp(join(PUBLIC, main)).resize(8, 6).raw().toBuffer()]);
        const diff = x.reduce((s, val, i) => s + Math.abs(val - y[i]), 0) / x.length;
        if (diff < 25) {
          await sharp(buf).resize({ width: HI_RES, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(hiOut);
          hiRes++;
        } else {
          console.warn(`  ${v.id}: high-res photo did not match the main photo, skipped`);
        }
      }
      await new Promise((r) => setTimeout(r, 120));
    } catch (e) {
      console.warn(`  ${v.id}: no high-res main photo (${e.message})`);
    }
  }
  if (existsSync(hiOut)) v.mainHiRes = true;
  else delete v.mainHiRes;
}

writeFileSync(DATA, src.slice(0, a) + JSON.stringify(vehicles, null, 2) + src.slice(b), 'utf8');
console.log(`Photos: ${made} WebP files made, ${hiRes} new high-res main photos, ${vehicles.filter((v) => v.mainHiRes).length} cars with high-res mains.`);
