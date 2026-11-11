/**
 * Layout audit: every page at common screen widths, in light mode, with automatic checks
 * for the problems people notice first, plus full-page screenshots to review by eye.
 *
 *   node scripts/serve-dist.mjs &
 *   OUT=/tmp/layout node scripts/layout-audit.mjs
 *
 * Checks per page and width:
 *  - page wider than the screen (sideways scrolling)
 *  - visible elements sticking out past the right edge
 *  - text cut off inside its box (not deliberate "…" truncation)
 *  - buttons / links overlapping each other
 *  - images stretched out of shape
 *  - tap targets smaller than 24px on phones
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const OUT = process.env.OUT || '/tmp/layout-audit';
const WIDTHS = (process.env.WIDTHS || '360,390,768,1024,1280,1440,1920').split(',').map(Number);
const PAGES = (process.env.PAGES ||
  '/,/cars,/vans,/vehicle/10475,/vehicle/10543,/used-cars/audi,/finance,/warranty,/sell-your-car,/reviews,/contact,/faq,/delivery,/part-exchange,/compare,/saved,/legal/privacy-policy,/legal/sitemap,/hub').split(',');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const report = [];
for (const width of WIDTHS) {
  const mobile = width < 768;
  const context = await browser.newContext({
    viewport: { width, height: mobile ? 780 : 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  await context.addInitScript(() => { try { localStorage.setItem('cookieConsent', 'accepted'); } catch {} });
  const page = await context.newPage();
  for (const path of PAGES) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    // Reveal scroll-in sections and let lazy images load
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
      scrollTo(0, 0);
      document.querySelectorAll('.reveal-init').forEach((e) => e.classList.add('reveal-visible'));
    });
    // Wait until every visible photo has actually loaded (up to 8s), like a real visit.
    await page.evaluate(async () => {
      const start = Date.now();
      const pending = () => [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight * 30).filter((i) => !i.complete);
      while (pending().length && Date.now() - start < 8000) await new Promise((r) => setTimeout(r, 150));
    });
    await page.waitForTimeout(300);
    const issues = await page.evaluate((isMobile) => {
      const out = [];
      const vw = document.documentElement.clientWidth;
      const name = (e) => {
        const t = (e.innerText || e.getAttribute('aria-label') || e.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        const cls = (typeof e.className === 'string' ? e.className : '').split(' ').filter(Boolean).slice(0, 3).join('.');
        return `${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}${t ? ` "${t}"` : ''}`;
      };
      const visible = (e) => {
        const s = getComputedStyle(e);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const clipped = (e) => {
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) return true;
        }
        return false;
      };
      if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways by ${document.documentElement.scrollWidth - vw}px`);
      const all = [...document.querySelectorAll('body *')].filter((e) => !e.closest('[aria-hidden="true"], .print-only, svg, [class*="print:block"]'));
      for (const e of all) {
        if (!visible(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.right > vw + 1 && !clipped(e) && getComputedStyle(e).position !== 'fixed') out.push(`sticks out ${Math.round(r.right - vw)}px: ${name(e)}`);
      }
      // Text cut off (single-line boxes narrower than their text, without ellipsis)
      for (const e of all) {
        if (!visible(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
        const s = getComputedStyle(e);
        if (s.textOverflow === 'ellipsis' || e.classList.contains('sr-only')) continue;
        if (e.scrollWidth > e.clientWidth + 2 && /(hidden|clip)/.test(s.overflowX)) out.push(`text cut off: ${name(e)}`);
      }
      // Overlapping clickable things
      // Floating buttons (inside a fixed/sticky bar) sit over content by design; they are checked separately.
      const floating = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') return true; } return false; };
      const clickables = all.filter((e) => /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && visible(e) && !floating(e));
      const rects = clickables.map((e) => [e, e.getBoundingClientRect()]);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const [a, ra] = rects[i];
          const [b, rb] = rects[j];
          if (a.contains(b) || b.contains(a)) continue;
          if (a.hasAttribute('data-overlay') || b.hasAttribute('data-overlay')) continue; // deliberate overlay (e.g. "View all" on a photo)
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 4 && oy > 4) out.push(`overlap: ${name(a)} × ${name(b)}`);
        }
      }
      // Stretched images
      for (const img of document.querySelectorAll('img')) {
        if (!visible(img) || !img.naturalWidth || getComputedStyle(img).objectFit !== 'fill') continue;
        const r = img.getBoundingClientRect();
        const ratio = r.width / r.height / (img.naturalWidth / img.naturalHeight);
        if (ratio > 1.08 || ratio < 0.92) out.push(`stretched image (${ratio.toFixed(2)}×): ${name(img)}`);
      }
      // Small tap targets on phones
      if (isMobile) {
        for (const [e, r] of rects) {
          if ((r.width < 24 || r.height < 24) && !e.closest('p, li > p') && !(e.tagName === 'INPUT' && e.closest('label')) && getComputedStyle(e).display !== 'inline') out.push(`small tap target ${Math.round(r.width)}×${Math.round(r.height)}: ${name(e)}`);
        }
      }
      return [...new Set(out)];
    }, mobile);
    const file = `${OUT}/${path.replace(/\//g, '_') || '_'}@${width}.png`;
    await page.screenshot({ path: file, fullPage: true });
    report.push({ path, width, issues, file });
    if (issues.length) console.log(`${path} @${width}: ${issues.length} issue(s)\n  - ${issues.slice(0, 12).join('\n  - ')}`);
  }
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const total = report.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n${total} layout issue(s) across ${PAGES.length} pages × ${WIDTHS.length} widths. Screenshots in ${OUT}`);
