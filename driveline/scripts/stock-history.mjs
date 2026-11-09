/**
 * Adds history-based facts to src/app/data/vehicles.data.ts after a stock fetch:
 *
 * - Price reductions: every price we have ever published for a vehicle is kept in
 *   scripts/stock-history.json. When the current price is lower than the price it had
 *   in the previous snapshot, the car gets `previousPrice` + `priceReducedAt`. The site
 *   shows "Reduced" for PRICE_DROP_DAYS after that, and only when the old price was a
 *   real published price (seen in an earlier sync), so "was/now" claims stay genuine.
 * - Sold: a car that was on the site last time but has left the Fengate feed (or is
 *   flagged sold) stays for SOLD_KEEP_DAYS with `status: 'sold'`, taken from the last
 *   committed copy of vehicles.data.ts, so buyers see stock moving and shared links
 *   still open.
 *
 * The first run seeds the history from every committed version of vehicles.data.ts.
 *
 * Usage: node scripts/stock-history.mjs   (part of `npm run sync:stock`, after the fetch)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PRICE_DROP_DAYS = 30;
export const SOLD_KEEP_DAYS = 7;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/app/data/vehicles.data.ts');
const DATA_REL = 'src/app/data/vehicles.data.ts';
const HISTORY = join(ROOT, 'scripts/stock-history.json');
const START = 'export const VEHICLES: Vehicle[] = ';
const DAY = 86_400_000;

function parseVehicles(src) {
  const a = src.indexOf(START);
  if (a < 0) return null;
  const from = a + START.length;
  const to = src.indexOf('];', from) + 1;
  try {
    return { vehicles: JSON.parse(src.slice(from, to)), from, to };
  } catch {
    return null;
  }
}

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Every committed snapshot of the stock file, oldest first. */
function committedSnapshots() {
  const log = git('log', '--reverse', '--format=%H %cI', '--', DATA_REL).trim();
  if (!log) return [];
  return log.split('\n').flatMap((line) => {
    const [hash, date] = line.split(' ');
    try {
      const parsed = parseVehicles(git('show', `${hash}:./${DATA_REL}`));
      return parsed ? [{ date: new Date(date).toISOString(), vehicles: parsed.vehicles }] : [];
    } catch {
      return [];
    }
  });
}

/** Record one snapshot's prices. prices[] holds each distinct price run: { price, since }. */
function record(history, vehicles, date) {
  for (const v of vehicles) {
    if (v.status === 'sold' || !v.price) continue;
    const h = (history[v.id] ??= { firstSeen: date, prices: [] });
    h.lastSeen = date;
    const last = h.prices.at(-1);
    if (!last || last.price !== v.price) h.prices.push({ price: v.price, since: date });
  }
}

const now = new Date();
const today = now.toISOString();
const src = readFileSync(DATA, 'utf8');
const current = parseVehicles(src);
if (!current) throw new Error('Could not read VEHICLES from ' + DATA);

// 1. Price history (seeded from git on first run)
let history = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : null;
if (!history) {
  history = {};
  for (const snap of committedSnapshots()) record(history, snap.vehicles, snap.date);
  console.log(`Seeded price history from git (${Object.keys(history).length} vehicles).`);
}
record(history, current.vehicles, today);

let reduced = 0;
for (const v of current.vehicles) {
  delete v.previousPrice;
  delete v.priceReducedAt;
  const runs = history[v.id]?.prices ?? [];
  if (runs.length < 2) continue;
  const latest = runs.at(-1);
  const before = runs.at(-2);
  const age = now.getTime() - new Date(latest.since).getTime();
  if (latest.price === v.price && before.price > v.price && age <= PRICE_DROP_DAYS * DAY) {
    v.previousPrice = before.price;
    v.priceReducedAt = latest.since.slice(0, 10);
    reduced++;
  }
}

// 2. Recently sold: on the site last commit, gone from the feed now
let previous = [];
try {
  previous = parseVehicles(git('show', `HEAD:./${DATA_REL}`))?.vehicles ?? [];
} catch {
  // no committed copy yet
}
const liveIds = new Set(current.vehicles.map((v) => v.id));
const sold = [];
for (const p of previous) {
  if (liveIds.has(p.id) || !p.images?.length) continue;
  const soldAt = p.status === 'sold' && p.soldAt ? p.soldAt : today.slice(0, 10);
  if (now.getTime() - new Date(soldAt).getTime() > SOLD_KEEP_DAYS * DAY) continue;
  const { previousPrice, priceReducedAt, isFeatured, isNew, ...rest } = p;
  sold.push({ ...rest, status: 'sold', soldAt });
  if (history[p.id]) history[p.id].soldAt ??= soldAt;
}
current.vehicles.push(...sold);

writeFileSync(HISTORY, JSON.stringify(history, null, 1) + '\n', 'utf8');
writeFileSync(DATA, src.slice(0, current.from) + JSON.stringify(current.vehicles, null, 2) + src.slice(current.to), 'utf8');

const reserved = current.vehicles.filter((v) => v.status === 'reserved').length;
console.log(
  `Price reduced (last ${PRICE_DROP_DAYS} days): ${reduced}. Reserved: ${reserved}. ` +
    `Recently sold kept: ${sold.length}${sold.length ? ` (${sold.map((v) => v.id).join(', ')})` : ''}.`,
);
