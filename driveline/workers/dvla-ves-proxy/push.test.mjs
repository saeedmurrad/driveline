// node --test workers/dvla-ves-proxy/push.test.mjs   (no network: fetch is mocked)
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.js';
import { encryptPayload, vapidAuthorization, customerMessage, searchMatches, validSubscription, cleanSearch } from './push.js';

const SITE = 'https://drivelinecarsales.co.uk';
const enc = new TextEncoder();
const unb64u = (s) => Uint8Array.from(Buffer.from(s, 'base64url'));
const cat = (...p) => Uint8Array.from(Buffer.concat(p.map((x) => Buffer.from(x))));

/** A stand-in browser: makes subscription keys and can decrypt what we send it (RFC 8291). */
async function fakeBrowser(endpoint = 'https://fcm.googleapis.com/fcm/send/abc123') {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const subscription = { endpoint, keys: { p256dh: Buffer.from(pub).toString('base64url'), auth: Buffer.from(auth).toString('base64url') } };
  const hkdf = async (salt, ikm, info, len) => {
    const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
  };
  async function decrypt(body) {
    const salt = body.slice(0, 16);
    const idLen = body[20];
    const serverPub = body.slice(21, 21 + idLen);
    const cipher = body.slice(21 + idLen);
    const serverKey = await crypto.subtle.importKey('raw', serverPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, pair.privateKey, 256));
    const ikm = await hkdf(auth, shared, cat(enc.encode('WebPush: info\0'), pub, serverPub), 32);
    const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
    const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, cipher));
    assert.equal(plain[plain.length - 1], 2, 'ends with the last-record marker');
    return new TextDecoder().decode(plain.slice(0, -1));
  }
  return { subscription, decrypt };
}

async function vapidEnv(extra = {}) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const store = new Map();
  const kv = {
    get: async (k, type) => (store.has(k) ? (type === 'json' ? JSON.parse(store.get(k)) : store.get(k)) : null),
    put: async (k, v) => void store.set(k, v),
    delete: async (k) => void store.delete(k),
    list: async ({ prefix, limit = 1000, cursor }) => {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? Number(cursor) : 0;
      const keys = all.slice(from, from + limit).map((name) => ({ name }));
      const complete = from + limit >= all.length;
      return { keys, list_complete: complete, cursor: complete ? undefined : String(from + limit) };
    },
  };
  return {
    env: {
      PUSH_KV: kv,
      VAPID_PRIVATE_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
      VAPID_PUBLIC_KEY: Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url'),
      PUSH_ADMIN_KEY: 'admin-secret',
      FIREBASE_PROJECT_ID: 'driveline-car-sales',
      ...extra,
    },
    store,
    publicKey: pair.publicKey,
  };
}

const post = (path, body, headers = {}, origin = SITE) =>
  new Request('https://worker.test' + path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}), ...headers } });

/** Replaces fetch; records every push sent and answers Firestore staff checks. */
function mockNetwork({ staffUids = [], pushStatus = 201 } = {}) {
  const pushes = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('firestore.googleapis.com')) {
      const uid = u.split('/staff/')[1];
      return new Response('{}', { status: staffUids.includes(uid) ? 200 : 403 });
    }
    pushes.push({ url: u, headers: init.headers, body: new Uint8Array(init.body) });
    return new Response(null, { status: typeof pushStatus === 'function' ? pushStatus(u) : pushStatus });
  };
  return { pushes, restore: () => (globalThis.fetch = real) };
}

const idTokenFor = (uid) => `x.${Buffer.from(JSON.stringify({ user_id: uid })).toString('base64url')}.y`;

test('encrypted payload can be read by the browser it was made for, and nobody else', async () => {
  const a = await fakeBrowser();
  const b = await fakeBrowser();
  const body = await encryptPayload(a.subscription, 'hello £ world');
  assert.equal(await a.decrypt(body), 'hello £ world');
  await assert.rejects(() => b.decrypt(body));
});

test('VAPID token is a valid ES256 signature for the push service origin', async () => {
  const { env, publicKey } = await vapidEnv();
  const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', env, 1_700_000_000_000);
  const [, token, key] = header.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.equal(key, env.VAPID_PUBLIC_KEY);
  const [h, c, s] = token.split('.');
  const claims = JSON.parse(Buffer.from(c, 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.exp, 1_700_000_000 + 12 * 3600);
  assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, unb64u(s), enc.encode(`${h}.${c}`)));
});

test('only real push services are accepted as endpoints', async () => {
  const good = (await fakeBrowser()).subscription;
  assert.equal(validSubscription(good), true);
  assert.equal(validSubscription({ ...good, endpoint: 'https://web.push.apple.com/abc' }), true);
  assert.equal(validSubscription({ ...good, endpoint: 'https://evil.example/abc' }), false);
  assert.equal(validSubscription({ ...good, endpoint: 'http://fcm.googleapis.com/abc' }), false);
  assert.equal(validSubscription({ ...good, endpoint: 'http://127.0.0.1:9/abc' }), false);
  assert.equal(validSubscription({ ...good, keys: { p256dh: 'AAAA', auth: good.keys.auth } }), false);
});

test('saved searches match the right cars', () => {
  const car = { id: '1', make: 'Audi', bodyType: 'Estate', fuelType: 'Diesel', transmission: 'Automatic', price: 9995, monthly: 212, category: 'car' };
  assert.equal(searchMatches({ make: 'audi' }, car), true);
  assert.equal(searchMatches({ make: 'BMW' }, car), false);
  assert.equal(searchMatches({ maxPrice: 9000 }, car), false);
  assert.equal(searchMatches({ maxMonthly: 220, bodyType: 'estate' }, car), true);
  assert.equal(searchMatches({ category: 'van' }, car), false);
  assert.deepEqual(cleanSearch({ make: ' Audi ', maxPrice: '9000', junk: 'x', maxMonthly: -1 }), { make: 'Audi', maxPrice: 9000 });
});

test('each device only hears about its own cars and searches', () => {
  const drops = [{ id: '10', title: '2019 Audi A6', was: 12995, now: 11995 }];
  const arrivals = [{ id: '20', title: '2020 Ford Focus', make: 'Ford', price: 8995, category: 'car' }];
  assert.equal(customerMessage({ vehicleIds: ['99'], searches: [] }, drops, arrivals), null);
  const drop = customerMessage({ vehicleIds: ['10'] }, drops, arrivals);
  assert.equal(drop.url, '/vehicle/10');
  assert.match(drop.body, /£11,995 \(was £12,995\)/);
  const fresh = customerMessage({ searches: [{ make: 'Ford' }] }, drops, arrivals);
  assert.equal(fresh.url, '/vehicle/20');
  const both = customerMessage({ vehicleIds: ['10'], searches: [{ make: 'Ford' }] }, drops, arrivals);
  assert.match(both.body, /1 price drop .* and 1 new arrival/);
});

test('subscribe stores the device, confirms by notification, and empty lists remove it', async () => {
  const { env, store } = await vapidEnv();
  const browser = await fakeBrowser();
  const net = mockNetwork();
  try {
    let r = await worker.fetch(post('/push/subscribe', { subscription: browser.subscription, vehicleIds: ['10475', '10475'], searches: [{ make: 'Audi' }], confirm: true }), env, {});
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, following: 2, confirmed: 'sent' });
    assert.equal(store.size, 1);
    assert.equal(net.pushes.length, 1);
    assert.equal(net.pushes[0].headers['Content-Encoding'], 'aes128gcm');
    const shown = JSON.parse(await browser.decrypt(net.pushes[0].body));
    assert.equal(shown.notification.title, 'Alerts are on');
    assert.equal(shown.notification.data.onActionClick.default.url, '/saved');

    r = await worker.fetch(post('/push/subscribe', { subscription: browser.subscription, vehicleIds: [], searches: [] }), env, {});
    assert.equal((await r.json()).following, 0);
    assert.equal(store.size, 0);

    r = await worker.fetch(post('/push/subscribe', { subscription: { endpoint: 'https://evil.example/x', keys: browser.subscription.keys } }), env, {});
    assert.equal(r.status, 400);
  } finally {
    net.restore();
  }
});

test('other websites cannot call the alert routes', async () => {
  const { env } = await vapidEnv();
  const r = await worker.fetch(post('/push/lead', { type: 'contact' }, {}, 'https://evil.example'), env, {});
  assert.equal(r.status, 403);
});

test('only staff can turn on enquiry alerts, and a new enquiry reaches every staff device once', async () => {
  const { env, store } = await vapidEnv();
  const phone = await fakeBrowser('https://fcm.googleapis.com/fcm/send/phone');
  const laptop = await fakeBrowser('https://web.push.apple.com/laptop');
  const net = mockNetwork({ staffUids: ['staffuid1'] });
  try {
    let r = await worker.fetch(post('/push/staff', { subscription: phone.subscription, idToken: idTokenFor('stranger1'), on: true }), env, {});
    assert.equal(r.status, 403);
    assert.equal(store.size, 0);

    for (const d of [phone, laptop]) {
      r = await worker.fetch(post('/push/staff', { subscription: d.subscription, idToken: idTokenFor('staffuid1'), on: true }), env, {});
      assert.deepEqual(await r.json(), { ok: true, on: true, confirmed: 'sent' });
    }
    net.pushes.length = 0;

    r = await worker.fetch(post('/push/lead', { type: 'test-drive', name: '<script>ignored</script>' }), env, {});
    assert.deepEqual(await r.json(), { ok: true, sent: 2 });
    const shown = JSON.parse(await phone.decrypt(net.pushes.find((p) => p.url.endsWith('/phone')).body));
    assert.equal(shown.notification.title, 'New enquiry');
    assert.match(shown.notification.body, /^Test drive request just came in/);
    assert.equal(shown.notification.data.url, '/hub');

    // A second enquiry inside the gap is not announced again (flood guard).
    r = await worker.fetch(post('/push/lead', { type: 'contact' }), env, {});
    assert.equal((await r.json()).throttled, true);
    assert.equal(net.pushes.length, 2);

    r = await worker.fetch(post('/push/staff', { subscription: phone.subscription, idToken: idTokenFor('staffuid1'), on: false }), env, {});
    assert.deepEqual(await r.json(), { ok: true, on: false });
    assert.equal([...store.keys()].filter((k) => k.startsWith('staff:')).length, 1);
  } finally {
    net.restore();
  }
});

test('broadcast needs the admin key, pages through devices, drops dead ones and never repeats a sync', async () => {
  const { env, store } = await vapidEnv();
  const net = mockNetwork({ pushStatus: (u) => (u.endsWith('/dead') ? 410 : 201) });
  try {
    const devices = [];
    for (let i = 0; i < 17; i++) {
      const d = await fakeBrowser(`https://fcm.googleapis.com/fcm/send/d${i}`);
      devices.push(d);
      await worker.fetch(post('/push/subscribe', { subscription: d.subscription, vehicleIds: i % 2 ? ['10'] : ['77'] }), env, {});
    }
    const dead = await fakeBrowser('https://fcm.googleapis.com/fcm/send/dead');
    await worker.fetch(post('/push/subscribe', { subscription: dead.subscription, vehicleIds: ['10'] }), env, {});
    assert.equal(store.size, 18);
    net.pushes.length = 0;

    const body = { id: 'sync-1', priceDrops: [{ id: '10', title: '2019 Audi A6', was: 12995, now: 11995 }], arrivals: [] };
    let r = await worker.fetch(post('/push/broadcast', body, {}, null), env, {});
    assert.equal(r.status, 403);

    let sent = 0;
    let cursor;
    let rounds = 0;
    do {
      r = await worker.fetch(post('/push/broadcast', { ...body, cursor }, { 'x-admin-key': 'admin-secret' }, null), env, {});
      const out = await r.json();
      sent += out.sent;
      cursor = out.cursor;
      rounds++;
      if (out.done) break;
    } while (cursor);
    assert.equal(rounds, 2);
    assert.equal(sent, 8); // devices 1,3,…,15 follow car 10
    assert.equal(store.has([...store.keys()].find((k) => k.startsWith('cust:') && JSON.parse(store.get(k)).sub.endpoint.endsWith('/dead')) ?? 'none'), false);

    r = await worker.fetch(post('/push/broadcast', body, { 'x-admin-key': 'admin-secret' }, null), env, {});
    assert.equal((await r.json()).already, true);
  } finally {
    net.restore();
  }
});

test('health says whether alerts are set up; routes answer 503 when they are not', async () => {
  const { env } = await vapidEnv();
  let r = await worker.fetch(new Request('https://worker.test/health'), env, {});
  assert.equal((await r.json()).push, true);
  r = await worker.fetch(post('/push/lead', { type: 'contact' }), {}, {});
  assert.equal(r.status, 503);
});
