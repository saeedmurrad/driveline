/**
 * End-to-end check of alerts with REAL notifications in a real Chrome window.
 *
 * Nothing reaches the live worker or the live database: the site is told to use a
 * local copy of the worker, and enquiries go to the Firebase emulators.
 *
 *   npm run build:gh-pages && cp dist/driveline/browser/index.csr.html dist/driveline/browser/404.html
 *   node scripts/serve-dist.mjs &
 *   FIRESTORE_BASE=http://127.0.0.1:<firestore emulator port> node scripts/local-push-worker.mjs &
 *   firebase emulators:exec --config firebase.alt-ports.json --only auth,firestore --project driveline-car-sales \
 *     "FIRESTORE_EMULATOR_HOST=127.0.0.1:8380 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9399 node scripts/alerts-check.mjs"
 *
 * A Chrome window opens (notifications need a real, visible browser). CAR picks the stock id.
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const WORKER = process.env.PUSH_API_URL || 'http://127.0.0.1:8799';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT = 'driveline-car-sales';
const CAR = process.env.CAR || '10475';
const ADMIN = (process.env.PUSH_ADMIN_KEY || readFileSync(new URL('../.env.push-admin.local', import.meta.url), 'utf8')).trim();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failed++;
};
const kv = async () => (await fetch(WORKER + '/__kv')).json();
const records = async (prefix) => Object.entries(await kv()).filter(([k]) => k.startsWith(prefix)).map(([, v]) => v);

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'dl-alerts-')), {
  channel: 'chrome',
  headless: false,
  viewport: { width: 1280, height: 860 },
  serviceWorkers: 'allow',
});
await context.grantPermissions(['notifications'], { origin: new URL(BASE).origin });
await context.addInitScript((worker) => {
  try {
    localStorage.setItem('dl.pushApi', worker);
    localStorage.setItem('cookieConsent', 'declined');
  } catch {}
}, WORKER);
for (const [std, host] of [['8080', FS], ['9099', AUTH]]) {
  const port = host.split(':')[1];
  if (port && port !== std) await context.route(`http://127.0.0.1:${std}/**`, (r) => r.continue({ url: r.request().url().replace(`127.0.0.1:${std}`, `127.0.0.1:${port}`) }));
}
await context.route(/^(mailto|tel|https:\/\/wa\.me)/, (r) => r.abort());
const page = context.pages()[0] ?? (await context.newPage());
const liveCalls = [];
page.on('request', (r) => { if (/workers\.dev\/push|firestore\.googleapis\.com/.test(r.url())) liveCalls.push(r.url()); });

/** Notifications the service worker is showing right now (title list). */
const shown = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, url: n.data?.url })));
async function waitForNotification(title, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const hit = (await shown()).find((n) => n.title === title);
    if (hit) return hit;
    await page.waitForTimeout(500);
  }
  return null;
}
const clearShown = () => page.evaluate(async () => { for (const n of await (await navigator.serviceWorker.ready).getNotifications()) n.close(); });

try {
  // ---------- price alert on a car page ----------
  await page.goto(`${BASE}/vehicle/${CAR}?emulators=1`, { waitUntil: 'networkidle' });
  await page.locator('[data-alert="price"] button').waitFor({ timeout: 15_000 });
  check('car page: price alert button shows', /Tell me if the price drops/.test(await page.locator('[data-alert="price"] button').innerText()));
  const [subRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/push/subscribe'), { timeout: 60_000 }),
    page.locator('[data-alert="price"] button').click(),
  ]);
  const subBody = await subRes.json();
  check('car page: sign-up accepted and confirmation sent to the browser', subRes.ok() && subBody.confirmed === 'sent', JSON.stringify(subBody));
  check('car page: button now says the alert is on', (await page.locator('[data-alert="price"] button').getAttribute('aria-pressed')) === 'true' && /Price alert on/.test(await page.locator('[data-alert="price"] button').innerText()));
  check('car page: says what will happen', /price drops/i.test(await page.locator('[data-alert="price"] .alert-note').innerText()));
  const welcome = await waitForNotification('Alerts are on');
  check('REAL notification arrives: "Alerts are on"', !!welcome, welcome ? welcome.body : 'nothing shown within 30s');
  let cust = await records('cust:');
  check('worker stores only the car id for this device', cust.length === 1 && cust[0].vehicleIds.join() === CAR && cust[0].searches.length === 0, JSON.stringify(cust));

  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[data-alert="price"] button').waitFor();
  await page.waitForTimeout(600);
  check('car page: alert still on after reload', (await page.locator('[data-alert="price"] button').getAttribute('aria-pressed')) === 'true');
  check('car page: no sideways scroll', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));

  // ---------- new-arrival alert on the stock list ----------
  await page.goto(`${BASE}/cars?make=Audi&maxMonthly=300`, { waitUntil: 'networkidle' });
  const arrBtn = page.locator('[data-alert="arrivals"] button');
  await arrBtn.waitFor();
  check('stock list: says what the alert covers', /Audi · up to £300 a month \(cars\)/.test(await page.locator('[data-alert="arrivals"] .alert-scope').innerText()), await page.locator('[data-alert="arrivals"] .alert-scope').innerText());
  await Promise.all([page.waitForResponse((r) => r.url().includes('/push/subscribe')), arrBtn.click()]);
  cust = await records('cust:');
  check('worker stores the search next to the car', cust.length === 1 && cust[0].vehicleIds.join() === CAR && JSON.stringify(cust[0].searches) === JSON.stringify([{ category: 'car', make: 'Audi', maxMonthly: 300 }]), JSON.stringify(cust));
  check('stock list: alert shows as on', (await arrBtn.getAttribute('aria-pressed')) === 'true');
  await page.goto(`${BASE}/cars?make=BMW`, { waitUntil: 'networkidle' });
  await page.locator('[data-alert="arrivals"] button').waitFor();
  await page.waitForTimeout(500);
  check('stock list: a different search is not marked as followed', (await page.locator('[data-alert="arrivals"] button').getAttribute('aria-pressed')) === 'false');

  // ---------- stock sync broadcast ----------
  await clearShown();
  const broadcast = (id, body) => fetch(WORKER + '/push/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN }, body: JSON.stringify({ id, ...body }) }).then((r) => r.json());
  let out = await broadcast('check-drop', { priceDrops: [{ id: CAR, title: '2019 Audi A6 Avant', was: 12995, now: 11995 }, { id: 'someone-elses-car', title: 'Other', was: 2, now: 1 }], arrivals: [] });
  check('broadcast: price drop sent to the one device following that car', out.sent === 1, JSON.stringify(out));
  const drop = await waitForNotification('Price drop');
  check('REAL notification arrives: "Price drop" with old and new price', !!drop && /£11,995 \(was £12,995\)/.test(drop.body) && drop.url === `/vehicle/${CAR}`, JSON.stringify(drop));
  out = await broadcast('check-drop', { priceDrops: [{ id: CAR, title: 'x', was: 2, now: 1 }], arrivals: [] });
  check('broadcast: the same sync is never announced twice', out.already === true && out.sent === 0, JSON.stringify(out));
  await clearShown();
  out = await broadcast('check-arrival', { priceDrops: [], arrivals: [
    { id: '99001', title: '2021 Audi A3', make: 'Audi', bodyType: 'Hatchback', fuelType: 'Petrol', transmission: 'Manual', price: 11995, monthly: 254, category: 'car' },
    { id: '99002', title: '2022 Audi Q7', make: 'Audi', bodyType: 'SUV', fuelType: 'Diesel', transmission: 'Automatic', price: 39995, monthly: 848, category: 'car' },
    { id: '99003', title: '2020 Ford Focus', make: 'Ford', bodyType: 'Hatchback', fuelType: 'Petrol', transmission: 'Manual', price: 8995, monthly: 191, category: 'car' },
  ] });
  const arrival = await waitForNotification('Just arrived');
  check('REAL notification arrives: "Just arrived" only for the Audi inside the monthly budget', out.sent === 1 && !!arrival && /2021 Audi A3/.test(arrival.body) && arrival.url === '/vehicle/99001', JSON.stringify(arrival));

  // ---------- staff alerts ----------
  const signUp = await (await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `alerts-staff-${Date.now()}@example.test`, password: 'test-only-pw', returnSecureToken: true }),
  })).json();
  await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/staff/${signUp.localId}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
  });
  await page.goto(`${BASE}/hub?emulators=1`, { waitUntil: 'networkidle' });
  await page.fill('#hub-email', signUp.email);
  await page.fill('#hub-password', 'test-only-pw');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('text=DriveLine Hub', { timeout: 15_000 });
  const staffBtn = page.locator('[data-staff-alerts]');
  await staffBtn.waitFor();
  check('hub: "Turn on alerts" button shows', /Turn on alerts/.test(await staffBtn.innerText()));
  await clearShown();
  const [staffRes] = await Promise.all([page.waitForResponse((r) => r.url().includes('/push/staff'), { timeout: 60_000 }), staffBtn.click()]);
  const staffBody = await staffRes.json();
  check('hub: staff sign-in accepted by the worker', staffRes.ok() && staffBody.on === true && staffBody.confirmed === 'sent', JSON.stringify(staffBody));
  check('hub: button says alerts are on', /Alerts on/.test(await staffBtn.innerText()) && (await staffBtn.getAttribute('aria-pressed')) === 'true');
  check('REAL notification arrives: "Enquiry alerts are on"', !!(await waitForNotification('Enquiry alerts are on')));
  check('hub header: no sideways scroll at phone width', await (async () => {
    await page.setViewportSize({ width: 360, height: 700 });
    await page.waitForTimeout(300);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await page.setViewportSize({ width: 1280, height: 860 });
    return !over;
  })());

  // A stranger's sign-in must not be able to register a staff device.
  const stranger = await (await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `alerts-stranger-${Date.now()}@example.test`, password: 'test-only-pw', returnSecureToken: true }),
  })).json();
  const fakeSub = { endpoint: 'https://fcm.googleapis.com/fcm/send/not-real', keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 1).toString('base64url') } };
  const strangerRes = await fetch(WORKER + '/push/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: fakeSub, idToken: stranger.idToken, on: true }) });
  check('worker refuses a signed-in non-staff account', strangerRes.status === 403 && (await records('staff:')).length === 1, String(strangerRes.status));

  // A real enquiry from the public form → staff notification.
  await clearShown();
  await page.goto(`${BASE}/contact?emulators=1`, { waitUntil: 'networkidle' });
  const form = page.locator('form').filter({ has: page.locator('[name="firstName"]') }).first();
  for (const [name, value] of [['firstName', 'Test'], ['lastName', 'Buyer'], ['email', 'buyer@example.test'], ['phone', '07700 900123'], ['message', 'Automated alerts test, please ignore']]) {
    const el = form.locator(`[name="${name}"]`).first();
    if (await el.count()) await el.fill(value);
  }
  const [leadReq] = await Promise.all([page.waitForRequest((r) => r.url().includes('/push/lead'), { timeout: 20_000 }), form.locator('button[type=submit]').click()]);
  check('enquiry form: tells the worker a lead arrived, with the type only', leadReq.postData() === JSON.stringify({ type: 'contact' }), leadReq.postData());
  const lead = await waitForNotification('New enquiry');
  check('REAL notification arrives for staff: "New enquiry"', !!lead && /Contact form just came in/.test(lead.body) && lead.url === '/hub' && !/Buyer|example\.test|07700/.test(lead.body), JSON.stringify(lead));

  // ---------- turning things off ----------
  // (the signed-in hub keeps a live connection open, so it never goes "network idle")
  await page.goto(`${BASE}/hub?emulators=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-staff-alerts][aria-pressed="true"]').waitFor({ timeout: 20_000 });
  await Promise.all([page.waitForResponse((r) => r.url().includes('/push/staff')), page.locator('[data-staff-alerts]').click()]);
  check('hub: turning alerts off removes the staff device', (await records('staff:')).length === 0 && /Turn on alerts/.test(await page.locator('[data-staff-alerts]').innerText()));
  await page.goto(`${BASE}/cars?make=Audi&maxMonthly=300`, { waitUntil: 'networkidle' });
  await page.locator('[data-alert="arrivals"] button[aria-pressed="true"]').waitFor();
  await Promise.all([page.waitForResponse((r) => r.url().includes('/push/subscribe')), page.locator('[data-alert="arrivals"] button').click()]);
  await page.goto(`${BASE}/vehicle/${CAR}`, { waitUntil: 'networkidle' });
  await page.locator('[data-alert="price"] button[aria-pressed="true"]').waitFor();
  await Promise.all([page.waitForResponse((r) => r.url().includes('/push/subscribe')), page.locator('[data-alert="price"] button').click()]);
  check('turning the last alert off removes the device from the worker', (await records('cust:')).length === 0, JSON.stringify(await records('cust:')));
  check('nothing was sent to the live worker or live database', liveCalls.length === 0, liveCalls.slice(0, 2).join(' '));
} catch (e) {
  check('run completed', false, String(e.message || e).split('\n')[0].slice(0, 300));
} finally {
  await context.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
