/**
 * DriveLine alerts: browser / app notifications (Web Push, no third-party account).
 *
 *   POST /push/subscribe   customer device: which cars and searches it follows
 *                          body { subscription, vehicleIds: [], searches: [], confirm? }
 *                          (both lists empty = stop all alerts for that device)
 *   POST /push/staff       staff device on/off: body { subscription, idToken, on }
 *                          (idToken = the hub's Firebase sign-in; must be on the staff list)
 *   POST /push/lead        the website tells us an enquiry was just saved: body { type }
 *                          → "New enquiry" notification to every staff device
 *   POST /push/broadcast   stock sync: header x-admin-key, body { id, priceDrops, arrivals, cursor? }
 *                          → each customer device hears about the cars / searches it follows
 *
 * Storage: KV namespace bound as PUSH_KV.
 *   cust:<hash>   { sub, vehicleIds, searches, at }
 *   staff:<hash>  { sub, uid, at }
 *   meta:*        small counters (last staff alert, last broadcast id)
 *
 * Secrets (wrangler secret put NAME):
 *   VAPID_PRIVATE_JWK   the private signing key as JWK JSON (made by scripts/make-vapid-keys.mjs)
 *   PUSH_ADMIN_KEY      shared secret for /push/broadcast
 * Vars (wrangler.toml): VAPID_PUBLIC_KEY, PUSH_SUBJECT, FIREBASE_PROJECT_ID
 *
 * Notification text never contains anything a visitor typed.
 */

const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
};

/** Only real browser push services may be called (stops the worker being used to hit other hosts). */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.apple\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^127\.0\.0\.1$/];
export function validSubscription(sub, env = {}) {
  try {
    if (!sub || typeof sub.endpoint !== 'string' || sub.endpoint.length > 1000) return false;
    const url = new URL(sub.endpoint);
    const local = url.hostname === '127.0.0.1';
    if (local ? env.ALLOW_LOCAL_PUSH !== '1' : url.protocol !== 'https:') return false;
    if (!PUSH_HOSTS.some((re) => re.test(url.hostname))) return false;
    return unb64u(sub.keys?.p256dh).length === 65 && unb64u(sub.keys?.auth).length === 16;
  } catch {
    return false;
  }
}

async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** RFC 8291 (aes128gcm): encrypts `text` so only that browser can read it. */
export async function encryptPayload(sub, text) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, localPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(enc.encode(text), new Uint8Array([2]))));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = localPublic.length;
  return concat(header, localPublic, cipher);
}

/** Signed "who is sending" token the push services require (VAPID, RFC 8292). */
export async function vapidAuthorization(endpoint, env, now = Date.now()) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: env.PUSH_SUBJECT || 'https://drivelinecarsales.co.uk',
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`));
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${env.VAPID_PUBLIC_KEY}`;
}

/** The shape Angular's service worker shows as a notification and opens on tap. */
export function notification({ title, body, url, tag }) {
  return JSON.stringify({
    notification: {
      title,
      body,
      icon: '/brand/icon-192.png',
      badge: '/brand/icon-192.png',
      tag,
      data: { url, onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url } } },
    },
  });
}

/** Sends one notification. Returns 'sent', 'gone' (browser unsubscribed) or 'failed'. */
export async function sendPush(sub, payload, env) {
  try {
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(sub.endpoint, env),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body: await encryptPayload(sub, payload),
    });
    if (r.status === 404 || r.status === 410) return 'gone';
    return r.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

async function keyFor(prefix, endpoint) {
  return prefix + b64u(await crypto.subtle.digest('SHA-256', enc.encode(endpoint))).slice(0, 40);
}

const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const money = (n) => '£' + Math.round(n).toLocaleString('en-GB');

/** Keeps only the fields we understand, so nothing odd is ever stored. */
export function cleanSearch(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const k of ['category', 'make', 'bodyType', 'fuelType', 'transmission']) {
    const v = clip(s[k], 40);
    if (v) out[k] = v;
  }
  for (const k of ['maxPrice', 'maxMonthly']) {
    const n = Number(s[k]);
    if (Number.isFinite(n) && n > 0 && n < 1e7) out[k] = Math.round(n);
  }
  return out;
}

export function searchMatches(search, car) {
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
  if (search.category && !same(search.category === 'van' ? 'van' : 'car', car.category === 'van' ? 'van' : 'car')) return false;
  if (search.make && !same(search.make, car.make)) return false;
  if (search.bodyType && !same(search.bodyType, car.bodyType)) return false;
  if (search.fuelType && !same(search.fuelType, car.fuelType)) return false;
  if (search.transmission && !same(search.transmission, car.transmission)) return false;
  if (search.maxPrice && !(car.price <= search.maxPrice)) return false;
  if (search.maxMonthly && !(car.monthly != null && car.monthly <= search.maxMonthly)) return false;
  return true;
}

/** What one customer device should hear about from a stock sync (null = nothing). */
export function customerMessage(record, priceDrops, arrivals) {
  const drops = priceDrops.filter((d) => (record.vehicleIds || []).includes(String(d.id)));
  const fresh = arrivals.filter((a) => (record.searches || []).some((s) => searchMatches(s, a)));
  if (!drops.length && !fresh.length) return null;
  if (drops.length === 1 && !fresh.length) {
    const d = drops[0];
    return { title: 'Price drop', body: `${d.title} is now ${money(d.now)} (was ${money(d.was)}).`, url: `/vehicle/${d.id}`, tag: `drop-${d.id}` };
  }
  if (fresh.length === 1 && !drops.length) {
    const a = fresh[0];
    return { title: 'Just arrived', body: `${a.title}, ${money(a.price)}. It matches a search you saved.`, url: `/vehicle/${a.id}`, tag: `new-${a.id}` };
  }
  const parts = [];
  if (drops.length) parts.push(`${drops.length} price drop${drops.length > 1 ? 's' : ''} on cars you follow`);
  if (fresh.length) parts.push(`${fresh.length} new arrival${fresh.length > 1 ? 's' : ''} matching your search`);
  return { title: 'DriveLine stock update', body: parts.join(' and ') + '.', url: drops.length ? '/saved' : '/cars', tag: 'stock-update' };
}

const LEAD_LABELS = {
  vehicle: 'Vehicle enquiry', 'test-drive': 'Test drive request', reserve: 'Reservation request', video: 'Video viewing request',
  finance: 'Finance enquiry', warranty: 'Warranty enquiry', 'part-exchange': 'Part exchange', sourcing: 'Find me a car', contact: 'Contact form',
};

async function subscribe(body, env) {
  const sub = body?.subscription;
  if (!validSubscription(sub, env)) return [400, { error: 'bad-subscription' }];
  const vehicleIds = [...new Set((Array.isArray(body.vehicleIds) ? body.vehicleIds : []).map((v) => clip(String(v), 40)).filter(Boolean))].slice(0, 40);
  const searches = (Array.isArray(body.searches) ? body.searches : []).map(cleanSearch).filter(Boolean).slice(0, 5);
  const key = await keyFor('cust:', sub.endpoint);
  if (!vehicleIds.length && !searches.length) {
    await env.PUSH_KV.delete(key);
    return [200, { ok: true, following: 0 }];
  }
  const record = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, vehicleIds, searches, at: new Date().toISOString() };
  await env.PUSH_KV.put(key, JSON.stringify(record));
  let confirmed;
  if (body.confirm) {
    confirmed = await sendPush(record.sub, notification({ title: 'Alerts are on', body: 'We will tell you here when a price drops or a matching car arrives.', url: '/saved', tag: 'alerts-on' }), env);
  }
  return [200, { ok: true, following: vehicleIds.length + searches.length, confirmed }];
}

/** True when the Firebase sign-in belongs to someone on the staff list (Firestore checks the token). */
async function staffUid(idToken, env) {
  try {
    const uid = JSON.parse(new TextDecoder().decode(unb64u(String(idToken).split('.')[1]))).user_id;
    if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return null;
    const base = env.FIRESTORE_BASE || 'https://firestore.googleapis.com';
    const r = await fetch(`${base}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/staff/${uid}`, { headers: { Authorization: `Bearer ${idToken}` } });
    return r.ok ? uid : null;
  } catch {
    return null;
  }
}

async function staff(body, env) {
  const sub = body?.subscription;
  if (!validSubscription(sub, env)) return [400, { error: 'bad-subscription' }];
  const uid = await staffUid(body.idToken, env);
  if (!uid) return [403, { error: 'not-staff' }];
  const key = await keyFor('staff:', sub.endpoint);
  if (!body.on) {
    await env.PUSH_KV.delete(key);
    return [200, { ok: true, on: false }];
  }
  const record = { sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, uid, at: new Date().toISOString() };
  await env.PUSH_KV.put(key, JSON.stringify(record));
  const confirmed = await sendPush(record.sub, notification({ title: 'Enquiry alerts are on', body: 'This device will be told when a new website enquiry arrives.', url: '/hub', tag: 'staff-on' }), env);
  return [200, { ok: true, on: true, confirmed }];
}

const LEAD_GAP_MS = 4000;

async function lead(body, env) {
  const label = LEAD_LABELS[clip(body?.type, 40)] || 'Website enquiry';
  // One alert at most every few seconds, so nobody can flood staff phones.
  const last = Number(await env.PUSH_KV.get('meta:lastLead')) || 0;
  if (Date.now() - last < LEAD_GAP_MS) return [200, { ok: true, sent: 0, throttled: true }];
  await env.PUSH_KV.put('meta:lastLead', String(Date.now()));
  const { keys } = await env.PUSH_KV.list({ prefix: 'staff:', limit: 20 });
  const payload = notification({ title: 'New enquiry', body: `${label} just came in. Open the hub to reply.`, url: '/hub', tag: 'lead' });
  let sent = 0;
  for (const k of keys) {
    const record = await env.PUSH_KV.get(k.name, 'json');
    if (!record) continue;
    const result = await sendPush(record.sub, payload, env);
    if (result === 'sent') sent++;
    else if (result === 'gone') await env.PUSH_KV.delete(k.name);
  }
  return [200, { ok: true, sent }];
}

const BROADCAST_PAGE = 15;

async function broadcast(request, body, env) {
  if (!env.PUSH_ADMIN_KEY || request.headers.get('x-admin-key') !== env.PUSH_ADMIN_KEY) return [403, { error: 'forbidden' }];
  const id = clip(body?.id, 80);
  const priceDrops = (Array.isArray(body.priceDrops) ? body.priceDrops : []).slice(0, 200);
  const arrivals = (Array.isArray(body.arrivals) ? body.arrivals : []).slice(0, 200);
  if (!id) return [400, { error: 'missing-id' }];
  // The same stock sync is never announced twice.
  if (!body.cursor && !body.force && (await env.PUSH_KV.get('meta:lastBroadcast')) === id) return [200, { ok: true, already: true, sent: 0, done: true }];
  const page = await env.PUSH_KV.list({ prefix: 'cust:', limit: BROADCAST_PAGE, cursor: body.cursor || undefined });
  let sent = 0;
  for (const k of page.keys) {
    const record = await env.PUSH_KV.get(k.name, 'json');
    const message = record && customerMessage(record, priceDrops, arrivals);
    if (!message) continue;
    const result = await sendPush(record.sub, notification(message), env);
    if (result === 'sent') sent++;
    else if (result === 'gone') await env.PUSH_KV.delete(k.name);
  }
  const done = page.list_complete !== false;
  if (done) await env.PUSH_KV.put('meta:lastBroadcast', id);
  return [200, { ok: true, sent, done, cursor: done ? null : page.cursor }];
}

export const pushConfigured = (env) => !!(env.PUSH_KV && env.VAPID_PRIVATE_JWK && env.VAPID_PUBLIC_KEY);

/** Handles POST /push/*. Returns [status, body]. */
export async function handlePush(path, request, env) {
  if (!pushConfigured(env)) return [503, { error: 'not-set-up' }];
  let body;
  try {
    body = await request.json();
  } catch {
    return [400, { error: 'bad-json' }];
  }
  if (path === '/push/subscribe') return subscribe(body, env);
  if (path === '/push/staff') return staff(body, env);
  if (path === '/push/lead') return lead(body, env);
  if (path === '/push/broadcast') return broadcast(request, body, env);
  return [404, { error: 'not-found' }];
}
