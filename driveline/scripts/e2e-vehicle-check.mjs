/**
 * End-to-end check of the DVLA lookup + DVSA MOT history features in Chrome, against
 * the real worker code with stand-in DVLA/DVSA servers (no real API is called):
 *
 *   node scripts/mock-vehicle-apis.mjs &                 # worker on :4320
 *   (build with dvlaLookupUrl 'http://127.0.0.1:4320' into dist/e2e-vehicle-check)
 *   DIST=dist/e2e-vehicle-check/browser PORT=4311 node scripts/serve-dist.mjs &
 *   node scripts/e2e-vehicle-check.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4311';
const WORKER = process.env.WORKER_URL || 'http://127.0.0.1:4320';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

// Worker itself
const blocked = await fetch(`${WORKER}/mot/LB15WMA`, { headers: { Origin: 'https://other-dealer.example' } });
check('worker refuses other websites', blocked.status === 403, String(blocked.status));
const health = await (await fetch(`${WORKER}/health`)).json();
check('worker health reports DVLA + MOT ready', health.dvla && health.mot, JSON.stringify(health));

const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED });
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Sell Your Car lookup
await page.goto(`${BASE}/sell-your-car`, { waitUntil: 'networkidle' });
const f = page.locator('app-part-exchange-form');
check('sell: Look up button shown when the service works', (await f.getByRole('button', { name: 'Look up' }).count()) === 1);
await f.locator('[name="peRegistration"]').fill('lb15 wma');
await f.getByRole('button', { name: 'Look up' }).click();
await page.waitForTimeout(1500);
const val = (n) => f.locator(`[name="${n}"]`).inputValue();
check('sell: make filled', (await val('peMake')) === 'Mini', await val('peMake'));
check('sell: model filled from MOT history', (await val('peModel')) === 'Countryman', await val('peModel'));
check('sell: colour filled', /green/i.test(await val('peColour')), await val('peColour'));
check('sell: fuel filled', (await f.locator('[name="peFuel"]').inputValue()) === 'Diesel');
const t = await f.innerText();
check('sell: DVLA box shown', /From DVLA/.test(t) && /Taxed/.test(t));
check('sell: MOT box shows last mileage', /Mileage at last MOT\s*86,812/.test(t), (/Mileage at last MOT[^\n]*\n?[^\n]*/.exec(t) ?? [''])[0]);
await f.locator('[name="peRegistration"]').fill('ZZ99ZZZ');
await f.getByRole('button', { name: 'Look up' }).click();
await page.waitForTimeout(1500);
const alert = await f.locator('[role=alert]').allInnerTexts();
check('sell: unknown plate gives a plain message', alert.some((a) => /could not find that registration/i.test(a)), alert.join(' | '));

// Vehicle page MOT history tab
await page.goto(`${BASE}/vehicle/10541`, { waitUntil: 'networkidle' });
const tab = page.getByRole('button', { name: 'MOT history' });
check('vehicle: MOT history tab shown', (await tab.count()) === 1);
await tab.click();
await page.waitForTimeout(1500);
const mt = await page.locator('app-mot-history').innerText();
check('vehicle: MOT valid until', /20 Jul 2026/.test(mt));
check('vehicle: first-time pass rate', /67%/.test(mt), (/\d+%/.exec(mt) ?? [''])[0]);
check('vehicle: mileage check', /Goes up every test/.test(mt));
check('vehicle: lists 4 tests with pass/fail', (mt.match(/\b(Pass|Fail)\b/gi) ?? []).length >= 4);
await page.locator('app-mot-history details').first().locator('summary').click();
check('vehicle: advisories open', /tyre worn close to legal limit/i.test(await page.locator('app-mot-history').innerText()));
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
check('vehicle (mobile): no sideways scroll with MOT tab', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);

check('no page errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(`\n${results.filter(Boolean).length}/${results.length} vehicle-check checks passed.`);
process.exit(results.every(Boolean) ? 0 : 1);
