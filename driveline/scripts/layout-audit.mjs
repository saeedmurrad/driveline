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
 *  - short button / badge labels that wrap onto two lines
 *  - separators (• · |) left dangling at the end or start of a wrapped line
 *  - collisions inside a floating bar (e.g. header logo, menu and buttons)
 *
 * THEME=prestige checks the Prestige theme; ENGINE=webkit uses Safari's engine.
 */
import { chromium, webkit } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const OUT = process.env.OUT || '/tmp/layout-audit';
const WIDTHS = (process.env.WIDTHS || '360,390,768,1024,1180,1280,1512,1920,2560').split(',').map(Number);
const PAGES = (process.env.PAGES ||
  '/,/cars,/vans,/vehicle/10475,/vehicle/10543,/vehicle/10541,/used-cars/audi,/finance,/warranty,/sell-your-car,/mot-check,/mot-check?reg=LB15WMA,/reviews,/contact,/faq,/delivery,/part-exchange,/compare,/saved,/legal/privacy-policy,/legal/sitemap,/hub').split(',');
mkdirSync(OUT, { recursive: true });

// ENGINE=webkit checks Safari's engine (every iPhone); default is Chrome
const ENGINE = process.env.ENGINE || 'chrome';
const browser = ENGINE === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
const report = [];
for (const width of WIDTHS) {
  const mobile = width < 768;
  const context = await browser.newContext({
    viewport: { width, height: mobile ? 780 : 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  // THEME=prestige checks the Prestige theme
  await context.addInitScript((t) => { try { localStorage.setItem('cookieConsent', 'accepted'); if (t) localStorage.setItem('dlTheme', t); } catch {} }, process.env.THEME || '');
  // Pages are checked a few at a time (CONCURRENCY, default 3), each in its own tab.
  const queue = [...PAGES];
  const worker = async () => {
  const page = await context.newPage();
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.waitForTimeout(1500));
    await page.waitForTimeout(400);
    // Reveal scroll-in sections and let lazy images load
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); }
      scrollTo(0, 0);
      document.querySelectorAll('.reveal-init').forEach((e) => e.classList.add('reveal-visible'));
    });
    // Wait until every visible photo has actually loaded (up to 8s), like a real visit.
    await page.evaluate(async () => {
      const start = Date.now();
      const pending = () => [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight * 30).filter((i) => !i.complete);
      while (pending().length && Date.now() - start < 5000) await new Promise((r) => setTimeout(r, 150));
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
      // A floating bar (fixed header, sticky price bar, compare tray) sits over the page by design, so
      // things in different layers are not compared. Inside one layer (e.g. the header's logo, menu
      // and buttons) nothing may collide.
      const fixedRoot = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { if (getComputedStyle(p).position === 'fixed') return p; } return null; };
      const clickables = all.filter((e) => /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && visible(e));
      const rects = clickables.map((e) => [e, e.getBoundingClientRect(), fixedRoot(e)]);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const [a, ra, fa] = rects[i];
          const [b, rb, fb] = rects[j];
          if (fa !== fb) continue;
          if (a.contains(b) || b.contains(a)) continue;
          if (a.hasAttribute('data-overlay') || b.hasAttribute('data-overlay')) continue; // deliberate overlay (e.g. "View all" on a photo)
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 4 && oy > 4) out.push(`overlap: ${name(a)} × ${name(b)}`);
        }
      }
      // Short button / link / badge labels that wrap onto a second line ("VIEW / DETAILS")
      const textLines = (el) => {
        const size = parseFloat(getComputedStyle(el).fontSize) || 14;
        const tops = [];
        const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          if (!n.textContent.trim() || !visible(n.parentElement)) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const q of r.getClientRects()) if (q.width > 1 && q.height > 1 && !tops.some((t) => Math.abs(t - q.top) < size * 0.7)) tops.push(q.top);
        }
        return tops.length;
      };
      for (const e of all) {
        const cls = typeof e.className === 'string' ? e.className : '';
        const isLabel = e.tagName === 'BUTTON' || (e.tagName === 'A' && /btn|rounded-(xl|full|lg|2xl)|pill|chip|cta|tile/.test(cls)) || /(^|\s)(badge|badge-[a-z]+|pf-chip|pf-tag|action-tile)(\s|$)/.test(cls);
        if (!isLabel || !visible(e) || e.hasAttribute('data-multiline')) continue;
        const text = (e.innerText || '').trim();
        if (!text || text.length > 28 || e.querySelector('p, div, li, br, small, h2, h3, img, picture')) continue;
        if (getComputedStyle(e).flexDirection === 'column') continue; // icon above its label, by design
        const lines = textLines(e);
        if (lines > 1) out.push(`label wraps onto ${lines} lines: ${name(e)}`);
      }
      // Separators (• · |) left dangling at the end or start of a wrapped line
      const SEP = /[•·|]/;
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const t = n.textContent;
        const el = n.parentElement;
        if (!SEP.test(t) || !el || !visible(el) || el.closest('.sr-only, script, style, noscript, [data-theme-only]')) continue;
        const box = (x, y) => { const r = document.createRange(); r.setStart(n, x); r.setEnd(n, y); return r.getBoundingClientRect(); };
        for (let i = 0; i < t.length; i++) {
          if (!SEP.test(t[i])) continue;
          const rs = box(i, i + 1);
          if (!rs.width) continue;
          let j = i + 1; while (j < t.length && /\s/.test(t[j])) j++;
          let k = i - 1; while (k >= 0 && /\s/.test(t[k])) k--;
          if (j < t.length && box(j, j + 1).top - rs.top > rs.height * 0.6) out.push(`separator left at the end of a line: ${name(el)}`);
          if (k >= 0 && rs.top - box(k, k + 1).top > rs.height * 0.6) out.push(`separator at the start of a line: ${name(el)}`);
          // Separator in its own element: compare with the neighbours
          if (t.trim().length === 1) {
            const nx = el.nextElementSibling, pv = el.previousElementSibling;
            const er = el.getBoundingClientRect();
            if (nx && visible(nx) && nx.getBoundingClientRect().top - er.top > er.height * 0.6) out.push(`separator left at the end of a line: ${name(el.parentElement)}`);
            if (pv && visible(pv) && er.top - pv.getBoundingClientRect().top > er.height * 0.6) out.push(`separator at the start of a line: ${name(el.parentElement)}`);
          }
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
    // Screenshots only where something was found (SHOTS=all keeps every page, for reviewing by eye)
    const file = `${OUT}/${path.replace(/[\/?=&]/g, '_') || '_'}@${width}.png`;
    if (issues.length || process.env.SHOTS === 'all') await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    report.push({ path, width, issues, file });
    if (issues.length) console.log(`${path} @${width}: ${issues.length} issue(s)\n  - ${issues.slice(0, 12).join('\n  - ')}`);
  }
  await page.close();
  };
  await Promise.all(Array.from({ length: Math.min(Number(process.env.CONCURRENCY || 3), PAGES.length) }, worker));
  await context.close();
}
await browser.close();
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const total = report.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n${total} layout issue(s) across ${PAGES.length} pages × ${WIDTHS.length} widths. Screenshots in ${OUT}`);
