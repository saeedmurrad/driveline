// Checks the monthly-budget search filter in Chrome and WebKit, all three themes (needs serve-dist on 4310).
import { chromium, webkit } from 'playwright-core';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
for (const [name, launch] of [['chrome', () => chromium.launch({ channel: 'chrome' })], ['webkit', () => webkit.launch()]]) {
  const browser = await launch();
  for (const theme of ['', 'prestige', 'forecourt']) {
    for (const width of [390, 1366]) {
      const ctx = await browser.newContext({ viewport: { width, height: 860 }, serviceWorkers: 'block' });
      await ctx.addInitScript((t) => { try { localStorage.setItem('cookieConsent', 'declined'); if (t) localStorage.setItem('dlTheme', t); } catch {} }, theme);
      const page = await ctx.newPage();
      const tag = `${name} ${theme || 'default'} ${width}`;
      await page.goto(BASE + '/cars', { waitUntil: 'networkidle' });
      const total = Number(await page.locator('p:has-text("Showing") span').nth(1).innerText());
      await page.getByRole('button', { name: /Advanced Filters/ }).click();
      const field = page.locator('#sw-monthly-page');
      await field.fill('200');
      const box = await field.boundingBox();
      ok(box && box.width >= 110, `${tag}: budget field wide enough (${box && Math.round(box.width)}px)`);
      await page.getByRole('button', { name: /^Search/ }).first().click();
      await page.waitForURL(/maxMonthly=200/);
      await page.waitForSelector('[data-monthly-budget]');
      const shown = Number(await page.locator('p:has-text("Showing") span').nth(1).innerText());
      ok(shown > 0 && shown < total, `${tag}: budget narrows the list (${shown} of ${total})`);
      const months = await page.locator('app-vehicle-card').evaluateAll((cards) => cards.map((c) => { const m = c.textContent.match(/Finance from\s*£([\d,]+)/); return m ? Number(m[1].replace(',', '')) : null; }));
      ok(months.length > 0 && months.every((m) => m !== null && m <= 200), `${tag}: every card is at or under £200 a month`);
      // Direct link keeps the filter and fills the field.
      await page.goto(BASE + '/cars?maxMonthly=150', { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-monthly-budget]');
      await page.getByRole('button', { name: /Advanced Filters/ }).click();
      ok((await page.locator('#sw-monthly-page').inputValue()) === '150', `${tag}: shared link fills the budget field`);
      const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      ok(!over, `${tag}: no sideways scroll`);
      await ctx.close();
    }
  }
  await browser.close();
}
console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
