/**
 * Live check of visitor alerts in a real Chrome window: turns a price alert on, waits for
 * the real "Alerts are on" notification from the live worker, then turns it off again so
 * no test sign-up is left behind. Sends no enquiry and touches no customer data.
 *
 *   node scripts/alerts-live-check.mjs        (CAR=<stock id> to pick the car)
 */
import { chromium } from 'playwright-core';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL || 'https://drivelinecarsales.co.uk';
const CAR = process.env.CAR || '10475';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); if (!ok) failed++; };

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'dl-alerts-live-')), { channel: 'chrome', headless: false, viewport: { width: 1280, height: 860 }, serviceWorkers: 'allow' });
await context.grantPermissions(['notifications'], { origin: new URL(BASE).origin });
await context.addInitScript(() => { try { localStorage.setItem('cookieConsent', 'declined'); } catch {} });
const page = context.pages()[0] ?? (await context.newPage());
const leads = [];
page.on('request', (r) => { if (/\/push\/lead|firestore\.googleapis\.com/.test(r.url())) leads.push(r.url()); });
try {
  for (const theme of ['', 'prestige', 'forecourt']) {
    await page.goto(`${BASE}/vehicle/${CAR}`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => (t ? localStorage.setItem('dlTheme', t) : localStorage.removeItem('dlTheme')), theme);
    await page.reload({ waitUntil: 'networkidle' });
    const btn = page.locator('[data-alert="price"] button');
    await btn.waitFor({ timeout: 20_000 });
    const box = await btn.boundingBox();
    check(`${theme || 'default'}: price alert button shows on the car page`, /Tell me if the price drops/.test(await btn.innerText()) && box.width > 150 && box.height >= 44, `${Math.round(box.width)}×${Math.round(box.height)}`);
    await page.goto(`${BASE}/cars?make=Audi`, { waitUntil: 'networkidle' });
    await page.locator('[data-alert="arrivals"] button').waitFor({ timeout: 20_000 });
    check(`${theme || 'default'}: new-arrival alert shows on the stock list`, /Audi \(cars\)/.test(await page.locator('[data-alert="arrivals"] .alert-scope').innerText()));
  }
  await page.goto(`${BASE}/vehicle/${CAR}`, { waitUntil: 'networkidle' });
  const btn = page.locator('[data-alert="price"] button');
  await btn.waitFor();
  const [on] = await Promise.all([page.waitForResponse((r) => r.url().includes('/push/subscribe'), { timeout: 60_000 }), btn.click()]);
  const body = await on.json();
  check('live worker accepts the sign-up and sends the confirmation', on.ok() && body.confirmed === 'sent' && body.following === 1, JSON.stringify(body));
  let got = null;
  for (let i = 0; i < 60 && !got; i++) {
    got = (await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.title))).find((t) => t === 'Alerts are on');
    if (!got) await page.waitForTimeout(500);
  }
  check('REAL notification arrives from the live worker: "Alerts are on"', !!got);
  check('button shows the alert is on', (await btn.getAttribute('aria-pressed')) === 'true');
  const [off] = await Promise.all([page.waitForResponse((r) => r.url().includes('/push/subscribe'), { timeout: 30_000 }), btn.click()]);
  const offBody = await off.json();
  check('turning it off removes the test sign-up from the live worker', off.ok() && offBody.following === 0, JSON.stringify(offBody));
  await page.goto(`${BASE}/hub`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#hub-email', { timeout: 15_000 });
  check('hub sign-in page still loads', true);
  check('no enquiry or staff alert was sent by this check', leads.filter((u) => /\/push\/lead/.test(u)).length === 0);
} catch (e) {
  check('run completed', false, String(e.message || e).split('\n')[0].slice(0, 300));
} finally {
  await context.close();
}
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
process.exit(failed ? 1 : 0);
