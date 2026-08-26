import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildSeedSnapshot } from './seed-data.mjs';

/**
 * @typedef {Object} PlatformSnapshot
 * @property {Object[]} dealers
 * @property {Object[]} vehicles
 * @property {Object[]} reviews
 * @property {Object[]} enquiries
 * @property {Object[]} users
 */

const DATA_DIR =
  process.env.PLATFORM_DATA_DIR ||
  join(process.cwd(), 'data', 'platform');

const DB_FILE = join(DATA_DIR, 'platform.json');

const SNAPSHOT_FILE = join(
  dirname(fileURLToPath(import.meta.url)),
  'seed',
  'platform.snapshot.json',
);

/** @returns {PlatformSnapshot} */
function loadInitialSnapshot() {
  if (existsSync(SNAPSHOT_FILE)) {
    return JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
  }
  return buildSeedSnapshot();
}

/** @type {PlatformSnapshot | null} */
let cache = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/** @returns {PlatformSnapshot} */
export function loadSnapshot() {
  if (cache) return cache;
  ensureDir();
  if (!existsSync(DB_FILE)) {
    cache = loadInitialSnapshot();
    writeSnapshot(cache);
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    return cache;
  } catch {
    cache = loadInitialSnapshot();
    writeSnapshot(cache);
    return cache;
  }
}

/** @param {PlatformSnapshot} snap */
export function writeSnapshot(snap) {
  ensureDir();
  cache = snap;
  writeFileSync(DB_FILE, JSON.stringify(snap, null, 2), 'utf8');
}

export function resetToSeed() {
  cache = buildSeedSnapshot();
  writeSnapshot(cache);
  return cache;
}

/** @param {import('express').Request} req */
export function resolveDealerSlugFromRequest(req) {
  const q = req.query?.dealer;
  if (typeof q === 'string' && q.trim()) return q.trim().toLowerCase();

  const host = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');

  if (!host || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return process.env.DEFAULT_DEALER_SLUG || 'demo';
  }

  const snap = loadSnapshot();
  for (const d of snap.dealers) {
    if (d.customDomains?.some((dom) => dom.toLowerCase() === host)) {
      return d.slug;
    }
    const sub = d.subdomain || d.slug;
    if (host === `${sub}.divinebytes.co.uk` || host.startsWith(`${sub}.`)) {
      return d.slug;
    }
  }

  return process.env.DEFAULT_DEALER_SLUG || 'demo';
}

/** @param {string} slug */
export function getDealerBySlug(slug) {
  const snap = loadSnapshot();
  return snap.dealers.find((d) => d.slug === slug) || null;
}

/** @param {string} id */
export function getDealerById(id) {
  const snap = loadSnapshot();
  return snap.dealers.find((d) => d.id === id) || null;
}

/** @param {string} dealerId @param {boolean} [includeNonLive] */
export function listVehicles(dealerId, includeNonLive = false) {
  const snap = loadSnapshot();
  return snap.vehicles.filter((v) => {
    if (v.dealerId !== dealerId) return false;
    if (includeNonLive) return true;
    return v.status === 'live' || v.status === 'reserved';
  });
}

/** @param {string} dealerId @param {string} vehicleId */
export function getVehicle(dealerId, vehicleId) {
  const snap = loadSnapshot();
  return (
    snap.vehicles.find(
      (v) => v.dealerId === dealerId && v.id === vehicleId,
    ) || null
  );
}

/** @param {string} dealerId */
export function listReviews(dealerId) {
  const snap = loadSnapshot();
  return snap.reviews.filter((r) => r.dealerId === dealerId);
}

/** @param {string} dealerId */
export function listEnquiries(dealerId) {
  const snap = loadSnapshot();
  return snap.enquiries
    .filter((e) => e.dealerId === dealerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** @param {Object} dealer */
export function upsertDealer(dealer) {
  const snap = loadSnapshot();
  const idx = snap.dealers.findIndex((d) => d.id === dealer.id);
  dealer.updatedAt = new Date().toISOString();
  if (idx >= 0) snap.dealers[idx] = dealer;
  else snap.dealers.push(dealer);
  writeSnapshot(snap);
  return dealer;
}

/** @param {Object} vehicle */
export function upsertVehicle(vehicle) {
  const snap = loadSnapshot();
  const idx = snap.vehicles.findIndex(
    (v) => v.dealerId === vehicle.dealerId && v.id === vehicle.id,
  );
  if (idx >= 0) snap.vehicles[idx] = vehicle;
  else snap.vehicles.push(vehicle);
  writeSnapshot(snap);
  return vehicle;
}

/** @param {string} dealerId @param {string} vehicleId */
export function deleteVehicle(dealerId, vehicleId) {
  const snap = loadSnapshot();
  snap.vehicles = snap.vehicles.filter(
    (v) => !(v.dealerId === dealerId && v.id === vehicleId),
  );
  writeSnapshot(snap);
}

/** @param {Object} enquiry */
export function addEnquiry(enquiry) {
  const snap = loadSnapshot();
  const record = {
    id: randomUUID(),
    read: false,
    createdAt: new Date().toISOString(),
    ...enquiry,
  };
  snap.enquiries.push(record);
  writeSnapshot(snap);
  return record;
}

/** @param {string} email @param {string} password */
export function authenticateUser(email, password) {
  const snap = loadSnapshot();
  const user = snap.users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase(),
  );
  if (!user || user.passwordHash !== password) return null;
  const { passwordHash: _, ...safe } = user;
  return safe;
}

/** @param {string} token */
export function getUserByToken(token) {
  if (!token?.startsWith('db_')) return null;
  const uid = token.slice(3);
  const snap = loadSnapshot();
  const user = snap.users.find((u) => u.uid === uid);
  if (!user) return null;
  const { passwordHash: _, ...safe } = user;
  return safe;
}

/** @param {Object} user */
export function createSessionToken(user) {
  return `db_${user.uid}`;
}

/** @param {Object} partial */
export function createDealer(partial) {
  const snap = loadSnapshot();
  const id = `dealer_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const dealer = {
    id,
    slug: partial.slug,
    name: partial.name,
    tagline: partial.tagline || '',
    theme: 'driveline',
    colors: partial.colors || { primary: '#2563eb', accent: '#f97316' },
    customDomains: [],
    subdomain: partial.slug,
    plan: partial.plan || 'starter',
    pageFlags: {
      finance: true,
      warranty: true,
      sellYourCar: true,
      reviews: true,
    },
    financeDisclaimer:
      'Finance subject to status. Figures are illustrative only.',
    business: partial.business,
    createdAt: now,
    updatedAt: now,
  };
  snap.dealers.push(dealer);
  writeSnapshot(snap);
  return dealer;
}

export function listDealers() {
  return loadSnapshot().dealers;
}
