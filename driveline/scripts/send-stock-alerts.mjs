/**
 * Tells visitors who turned on alerts about the latest stock sync:
 *  - price drops on cars they follow
 *  - new arrivals that match a search they saved
 *
 * Compares the two most recent committed versions of src/app/data/vehicles.data.ts,
 * so run it after the sync has been committed and deployed (the notification links
 * open the live site):
 *
 *   npm run alerts:send            # send
 *   npm run alerts:send -- --dry   # only print what would be sent
 *
 * Needs the admin key in the PUSH_ADMIN_KEY environment variable or in the
 * git-ignored file .env.push-admin.local. The worker refuses to announce the same
 * sync twice, so running it again is harmless.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_REL = 'src/app/data/vehicles.data.ts';
const START = 'export const VEHICLES: Vehicle[] = ';
const WORKER = (process.env.PUSH_API_URL || 'https://driveline-dvla-ves-proxy.snatechltd.workers.dev').replace(/\/+$/, '');
const DRY = process.argv.includes('--dry');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

export function parseVehicles(src) {
  const a = src.indexOf(START);
  if (a < 0) throw new Error('Could not find the stock list in ' + DATA_REL);
  const from = a + START.length;
  return JSON.parse(src.slice(from, src.indexOf('];', from) + 1));
}

/** Same illustrative figure the site shows: 60 months, no deposit, 9.9% APR (src/app/utils/finance-display.ts). */
export function monthly(price) {
  if (!Number.isFinite(price) || price < 500) return null;
  const r = 9.9 / 100 / 12;
  const pow = Math.pow(1 + r, 60);
  return Math.round((price * r * pow) / (pow - 1));
}

const onSale = (v) => !v.status || v.status === 'live';
const title = (v) => `${v.year} ${v.make} ${v.model}`;

/** What changed between two stock lists that visitors asked to hear about. */
export function stockChanges(before, after) {
  const old = new Map(before.map((v) => [String(v.id), v]));
  const priceDrops = [];
  const arrivals = [];
  for (const v of after) {
    if (!onSale(v)) continue;
    const prev = old.get(String(v.id));
    if (!prev) {
      arrivals.push({ id: String(v.id), title: title(v), make: v.make, bodyType: v.bodyType, fuelType: v.fuelType, transmission: v.transmission, price: v.price, monthly: monthly(v.price), category: v.category === 'van' ? 'van' : 'car' });
    } else if (onSale(prev) && v.price < prev.price) {
      priceDrops.push({ id: String(v.id), title: title(v), was: prev.price, now: v.price });
    }
  }
  return { priceDrops, arrivals };
}

async function main() {
  const commits = git('log', '-2', '--format=%H', '--', DATA_REL).trim().split('\n').filter(Boolean);
  if (commits.length < 2) {
    console.log('Only one version of the stock list exists; nothing to compare.');
    return;
  }
  const [newer, older] = commits;
  const after = parseVehicles(git('show', `${newer}:./${DATA_REL}`));
  const before = parseVehicles(git('show', `${older}:./${DATA_REL}`));
  const { priceDrops, arrivals } = stockChanges(before, after);
  console.log(`Stock sync ${newer.slice(0, 7)} (compared with ${older.slice(0, 7)}): ${priceDrops.length} price drop(s), ${arrivals.length} new arrival(s).`);
  for (const d of priceDrops) console.log(`  drop     ${d.title}: £${d.was} → £${d.now}`);
  for (const a of arrivals) console.log(`  arrival  ${a.title}: £${a.price}`);
  if (!priceDrops.length && !arrivals.length) return;
  if (DRY) {
    console.log('Dry run: nothing sent.');
    return;
  }

  const keyFile = join(ROOT, '.env.push-admin.local');
  const adminKey = (process.env.PUSH_ADMIN_KEY || (existsSync(keyFile) ? readFileSync(keyFile, 'utf8') : '')).trim();
  if (!adminKey) throw new Error('No admin key: set PUSH_ADMIN_KEY or create .env.push-admin.local');

  let cursor;
  let sent = 0;
  for (let round = 0; round < 200; round++) {
    const r = await fetch(WORKER + '/push/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ id: newer, priceDrops, arrivals, cursor }),
    });
    if (!r.ok) throw new Error(`Worker answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const out = await r.json();
    if (out.already) {
      console.log('This sync was already announced; nothing sent.');
      return;
    }
    sent += out.sent;
    if (out.done) break;
    cursor = out.cursor;
  }
  console.log(`Sent ${sent} notification(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
