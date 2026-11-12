/**
 * Checks every car in stock against the official records and stores a compact result on
 * each vehicle (`official`) in src/app/data/vehicles.data.ts:
 *
 *   - DVLA Vehicle Enquiry Service: make, colour, fuel, year, engine size, first registration
 *   - DVSA MOT history: number of tests and passes, first-time pass rate, current MOT expiry,
 *     the last recorded mileage and whether the mileage rises at every test
 *
 * The site uses it for the "Checked against official records" panel on each car page and
 * the "DVLA & MOT checked" line on cards. Nothing is invented: a car is only marked as
 * matching when the advertised details agree with the records; differences are listed at
 * the end of the run so the advert can be corrected.
 *
 * Lookups go through the vehicle check worker (keys live there, not here). Results are kept
 * in scripts/stock-official.json, so a car keeps its last good check if a lookup fails.
 *
 * Usage: node scripts/verify-stock.mjs            (part of `npm run sync:stock`)
 *        ONLY=YW19XHE,LB15WMA node scripts/verify-stock.mjs
 *        WORKER_URL=http://127.0.0.1:4320 node scripts/verify-stock.mjs   (stand-in worker)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'src/app/data/vehicles.data.ts');
const CACHE = join(ROOT, 'scripts/stock-official.json');
const START = 'export const VEHICLES: Vehicle[] = ';
const WORKER = (process.env.WORKER_URL || 'https://driveline-dvla-ves-proxy.snatechltd.workers.dev').replace(/\/+$/, '');
const ORIGIN = process.env.SITE_ORIGIN || 'https://drivelinecarsales.co.uk';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',').map((r) => r.trim().toUpperCase())) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

const src = readFileSync(DATA, 'utf8');
const from = src.indexOf(START) + START.length;
const to = src.indexOf('];', from) + 1;
const vehicles = JSON.parse(src.slice(from, to));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

const KM_TO_MI = 0.621371;
const miles = (m) => Math.round(m.unit === 'km' ? m.value * KM_TO_MI : m.value);
const days = (a, b) => Math.abs(new Date(b) - new Date(a)) / 86_400_000;

/** Same rules as summariseMot() in src/app/models/mot-history.model.ts */
function summarise(h) {
  const tests = h.tests ?? [];
  const rank = (t) => (t.result === 'fail' ? 0 : 1);
  const oldestFirst = [...tests].sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b) || (a.mileage ? miles(a.mileage) : 0) - (b.mileage ? miles(b.mileage) : 0));
  const readings = oldestFirst.filter((t) => t.mileage).map((t) => ({ date: t.date, miles: miles(t.mileage) }));
  const points = [];
  for (const r of readings) {
    const prev = points.at(-1);
    if (prev && days(prev.date, r.date) <= 31) points[points.length - 1] = r;
    else points.push(r);
  }
  let rounds = 0, firstTime = 0, lastRoundStart = null;
  for (const t of oldestFirst) {
    if (!lastRoundStart || days(lastRoundStart, t.date) > 31) {
      rounds++;
      if (t.result === 'pass') firstTime++;
      lastRoundStart = t.date;
    }
  }
  const latestPass = tests.find((t) => t.result === 'pass') ?? null;
  const last = points.at(-1);
  return {
    model: h.model ?? null,
    tests: tests.length,
    passes: tests.filter((t) => t.result === 'pass').length,
    firstTimePassRate: rounds ? Math.round((firstTime / rounds) * 100) : null,
    validUntil: latestPass?.expiry ?? null,
    dueDate: h.motTestDueDate ?? null,
    lastMiles: last?.miles ?? null,
    lastDate: last?.date ?? null,
    mileageConsistent: points.length >= 2 ? points.every((p, i) => !i || p.miles >= points[i - 1].miles) : null,
    recall: h.hasOutstandingRecall ?? null,
  };
}

async function getJson(url, init) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { ...init, headers: { Origin: ORIGIN, Accept: 'application/json', ...(init?.headers ?? {}) } });
      if (r.status === 404) return { notFound: true };
      if (r.status === 429 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
      if (!r.ok) return { error: r.status };
      return { data: await r.json() };
    } catch {
      await sleep(1000 * (attempt + 1));
    }
  }
  return { error: 'unreachable' };
}

let checked = 0, kept = 0, failed = 0;
for (const v of vehicles) {
  const reg = (v.registration || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (!reg || (ONLY && !ONLY.has(reg))) {
    if (reg && cache[reg]) v.official = cache[reg];
    continue;
  }
  const [d, m] = [
    await getJson(WORKER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationNumber: reg }) }),
    await getJson(`${WORKER}/mot/${encodeURIComponent(reg)}`),
  ];
  if (!d.data && !m.data) {
    failed++;
    if (cache[reg]) { v.official = cache[reg]; kept++; } else delete v.official;
    console.log(`  ${reg}: no record (${d.notFound || m.notFound ? 'not found' : d.error || m.error})${cache[reg] ? ', kept the check from ' + cache[reg].checkedAt : ''}`);
    await sleep(200);
    continue;
  }
  const official = { checkedAt: today };
  if (d.data) {
    const x = d.data;
    official.dvla = Object.fromEntries(Object.entries({
      make: x.make, colour: x.colour, fuelType: x.fuelType, year: x.yearOfManufacture, firstRegistered: x.monthOfFirstRegistration,
      engineCc: x.engineCapacity, co2: x.co2Emissions, euroStatus: x.euroStatus,
    }).filter(([, val]) => val !== undefined && val !== null && val !== ''));
  }
  if (m.data) official.mot = summarise(m.data);
  v.official = official;
  cache[reg] = official;
  checked++;
  await sleep(200);
}

writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n', 'utf8');
writeFileSync(DATA, src.slice(0, from) + JSON.stringify(vehicles, null, 2) + src.slice(to), 'utf8');

// ---- Report: adverts that do not agree with the records (fix the advert, not the record) ----
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const issues = [];
for (const v of vehicles) {
  const o = v.official;
  if (!o) continue;
  const name = `${v.id} ${v.registration} ${v.year} ${v.make} ${v.model}`;
  if (o.mot?.lastMiles != null && v.mileage < o.mot.lastMiles) issues.push(`${name}: advertised ${v.mileage.toLocaleString('en-GB')} miles is LOWER than the last MOT reading ${o.mot.lastMiles.toLocaleString('en-GB')} (${o.mot.lastDate})`);
  if (o.mot?.mileageConsistent === false) issues.push(`${name}: MOT mileage record does not rise at every test`);
  if (o.dvla?.make && !norm(o.dvla.make).startsWith(norm(v.make).slice(0, 4)) && !norm(v.make).startsWith(norm(o.dvla.make).slice(0, 4))) issues.push(`${name}: DVLA make is ${o.dvla.make}`);
  if (o.dvla?.fuelType && !norm(o.dvla.fuelType).includes(norm(v.fuelType).slice(0, 5)) && !/hybrid|electric/i.test(o.dvla.fuelType + v.fuelType)) issues.push(`${name}: advert says ${v.fuelType}, DVLA says ${o.dvla.fuelType}`);
  if (o.dvla?.year && Math.abs(o.dvla.year - v.year) > 1) issues.push(`${name}: advert year ${v.year}, DVLA year of manufacture ${o.dvla.year}`);
  if (o.dvla?.engineCc && v.engineSize && Math.abs(o.dvla.engineCc / 1000 - v.engineSize) > 0.15) issues.push(`${name}: advert engine ${v.engineSize}L, DVLA ${o.dvla.engineCc}cc`);
}
console.log(`Official check: ${checked} checked, ${kept} kept from an earlier check, ${failed} failed, ${vehicles.filter((v) => v.official).length}/${vehicles.length} vehicles carry a check.`);
if (issues.length) {
  console.log(`\n${issues.length} advert detail(s) to review:`);
  for (const i of issues) console.log('  - ' + i);
}
