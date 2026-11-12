/**
 * Style snapshot: records the computed colours, fonts, shadows and radii of every visible
 * element on key pages, so a refactor can be proven to change nothing visually.
 *
 *   node scripts/serve-dist.mjs &
 *   OUT=/tmp/before.json node scripts/style-snapshot.mjs
 *   ... change code, rebuild ...
 *   OUT=/tmp/after.json node scripts/style-snapshot.mjs
 *   node scripts/style-snapshot.mjs --diff /tmp/before.json /tmp/after.json
 *
 * THEME=prestige snapshots a theme other than Default.
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

if (process.argv[2] === '--diff') {
  const [a, b] = [JSON.parse(readFileSync(process.argv[3], 'utf8')), JSON.parse(readFileSync(process.argv[4], 'utf8'))];
  let diffs = 0;
  for (const key of Object.keys(a)) {
    const x = a[key];
    const y = b[key] || [];
    if (x.length !== y.length) console.log(`${key}: element count ${x.length} → ${y.length}`);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      if (x[i] !== y[i]) {
        diffs++;
        if (diffs <= 40) console.log(`${key} #${i}\n  - ${x[i]}\n  + ${y[i]}`);
      }
    }
  }
  console.log(`\n${diffs} style difference(s) across ${Object.keys(a).length} page views.`);
  process.exit(diffs ? 1 : 0);
}

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const OUT = process.env.OUT || '/tmp/style-snapshot.json';
const THEME = process.env.THEME || '';
const PAGES = (process.env.PAGES || '/,/cars/,/vehicle/10475/,/finance/,/sell-your-car/,/contact/,/faq/,/compare/,/legal/privacy-policy/,/hub').split(',');
const PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-bottom-color', 'border-left-color', 'box-shadow', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-transform', 'border-radius', 'outline-color', 'fill', 'stroke', 'opacity'];

const browser = await chromium.launch({ channel: 'chrome' });
const result = {};
for (const width of [390, 1440]) {
  for (const dark of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(([d, t]) => {
      try {
        localStorage.setItem('cookieConsent', 'accepted');
        localStorage.setItem('darkMode', d ? 'true' : 'false');
        if (t) localStorage.setItem('dlTheme', t);
      } catch {}
    }, [dark, THEME]);
    const page = await context.newPage();
    for (const path of PAGES) {
      // The contact page's map can keep the network busy; fall back to a fixed wait
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => page.waitForTimeout(1500));
      await page.waitForTimeout(400);
      result[`${path}@${width}${dark ? '-dark' : ''}`] = await page.evaluate((props) => {
        document.querySelectorAll('.reveal-init').forEach((e) => e.classList.add('reveal-visible'));
        return [...document.querySelectorAll('body *')]
          .filter((e) => !e.closest('svg') || e.tagName === 'svg')
          // Theme plumbing added later (theme-only elements, accent markers, theme picker) is not part of the comparison
          .filter((e) => !e.closest('[data-theme-only], .title-accent, [data-theme-picker]'))
          .map((e) => {
            const s = getComputedStyle(e);
            return `${e.tagName.toLowerCase()}.${(typeof e.className === 'string' ? e.className : '').split(' ').slice(0, 2).join('.')} ` + props.map((p) => s.getPropertyValue(p)).join(' | ');
          });
      }, PROPS);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(OUT, JSON.stringify(result));
console.log(`Saved ${Object.keys(result).length} page views to ${OUT}`);
