/**
 * Accessibility check (WCAG 2.1 A/AA rules from axe-core) of the main pages in Chrome,
 * in light and dark mode. Run against `node scripts/serve-dist.mjs`.
 *
 *   node scripts/a11y-check.mjs            # summary
 *   VERBOSE=1 node scripts/a11y-check.mjs  # every failing element
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const PAGES = ['/', '/cars', '/vehicle/10541', '/used-cars/audi', '/finance', '/warranty', '/sell-your-car', '/contact', '/reviews', '/faq', '/delivery', '/part-exchange', '/compare', '/saved', '/legal/privacy-policy'];

const browser = await chromium.launch({ channel: 'chrome' });
let total = 0;
const all = [];
const byRule = new Map();
for (const dark of [false, true]) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, colorScheme: dark ? 'dark' : 'light' });
  await context.addInitScript((d) => { try { localStorage.setItem('darkMode', String(d)); localStorage.setItem('cookieConsent', 'declined'); } catch {} }, dark);
  const page = await context.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.evaluate(() => { for (let y = 0; y < document.body.scrollHeight; y += 600) scrollTo(0, y); scrollTo(0, 0); });
    await page.waitForTimeout(800);
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(async () =>
      (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((v) => ({
        id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.map((n) => n.target.join(' ') + (n.any?.[0]?.message ? ' :: ' + n.any[0].message : '')),
      })),
    );
    for (const v of res) {
      total += v.nodes.length;
      const key = `${v.id} (${v.impact}) – ${v.help}`;
      const e = byRule.get(key) ?? { count: 0, where: new Set(), examples: [] };
      e.count += v.nodes.length;
      e.where.add(`${dark ? 'dark' : 'light'} ${path}`);
      e.examples.push(...v.nodes.slice(0, 3).map((n) => `${dark ? 'dark' : 'light'} ${path}: ${n}`));
      for (const n of v.nodes) all.push({ rule: v.id, mode: dark ? 'dark' : 'light', path, node: n });
      byRule.set(key, e);
    }
  }
  await context.close();
}
await browser.close();
for (const [rule, e] of byRule) {
  console.log(`\n${rule}: ${e.count} element(s) on ${[...e.where].slice(0, 6).join(', ')}${e.where.size > 6 ? '…' : ''}`);
  for (const ex of e.examples.slice(0, process.env.VERBOSE ? 50 : 4)) console.log('   - ' + ex.slice(0, 260));
}
if (process.env.JSON_OUT) (await import('node:fs')).writeFileSync(process.env.JSON_OUT, JSON.stringify(all, null, 1));
console.log(`\n${total} accessibility issue(s) across ${PAGES.length} pages × light/dark.`);
process.exit(total ? 1 : 0);
