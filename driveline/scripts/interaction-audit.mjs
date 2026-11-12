/**
 * Interaction audit: opens every popup, menu, tab and multi-step form on phones and tablets,
 * in Safari's engine (WebKit, as on every iPhone) and Chrome, light and dark, and checks
 * what is on screen *inside* each one:
 *  - fields, labels, buttons or text overlapping each other
 *  - anything poking out of its popup / card, or past the screen edge
 *  - text cut off, fields of different heights sitting side by side
 *  - popups taller than the screen that cannot be scrolled
 *
 *   node scripts/serve-dist.mjs &
 *   OUT=/tmp/ia node scripts/interaction-audit.mjs        # ENGINES=webkit,chrome WIDTHS=360,390,768 ONLY=car-test-drive,menu
 *
 * Needs the WebKit engine once: npx playwright-core install webkit
 */
import { chromium, webkit } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const OUT = process.env.OUT || '/tmp/interaction-audit';
const ENGINES = (process.env.ENGINES || 'webkit,chrome').split(',');
const WIDTHS = (process.env.WIDTHS || '360,390,768').split(',').map(Number);
const THEMES = (process.env.THEMES || 'light,dark').split(',');
const CAR = process.env.CAR || '10475';
mkdirSync(OUT, { recursive: true });

const btn = (page, name) => page.getByRole('button', { name }).filter({ visible: true }).first();

/** Each scenario opens something; `scope` is the part of the page to check (default: open dialog or whole page). */
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SCENARIOS_ALL = [
  { name: 'car-test-drive', path: `/vehicle/${CAR}/`, run: (p) => btn(p, 'Book a test drive').click() },
  { name: 'car-reserve', path: `/vehicle/${CAR}/`, run: (p) => btn(p, /^Reserve it$/).click() },
  { name: 'car-video', path: `/vehicle/${CAR}/`, run: (p) => btn(p, /^Video viewing$/).click() },
  {
    name: 'car-part-exchange', path: `/vehicle/${CAR}/`, steps: true,
    run: (p) => btn(p, /^Part exchange$/).click(),
  },
  { name: 'car-photos', path: `/vehicle/${CAR}/`, run: (p) => btn(p, /View all|Show all photos|All \d+ photos/).click() },
  { name: 'car-tab-features', path: `/vehicle/${CAR}/`, scope: '[role=tabpanel], .lg\\:col-span-2', run: (p) => p.getByRole('button', { name: /Features/ }).first().click() },
  { name: 'car-tab-finance', path: `/vehicle/${CAR}/`, scope: '.lg\\:col-span-2', run: (p) => p.getByRole('button', { name: 'Finance', exact: true }).first().click() },
  { name: 'car-tab-running', path: `/vehicle/${CAR}/`, scope: '.lg\\:col-span-2', run: (p) => p.getByRole('button', { name: 'Running costs' }).first().click() },
  { name: 'car-enquiry-errors', path: `/vehicle/${CAR}/`, scope: 'form:has(textarea[name=message])', run: async (p) => { await p.locator('form:has(textarea[name=message]) button[type=submit]').click(); } },
  { name: 'car-delivery-check', path: `/vehicle/${CAR}/`, scope: 'app-delivery-check', run: async (p) => { await p.locator('app-delivery-check input').fill('CB1 1AA'); await p.locator('app-delivery-check button').first().click(); await p.waitForTimeout(1500); } },
  { name: 'menu', path: '/', run: (p) => p.getByRole('button', { name: /Toggle menu/i }).click(), mobileOnly: true },
  { name: 'cars-advanced-filters', path: '/cars/', scope: 'app-search-widget', run: (p) => btn(p, /Advanced Filters/).click() },
  { name: 'cars-list-view', path: '/cars/', run: (p) => p.getByRole('button', { name: /list view/i }).first().click().catch(() => p.locator('button[aria-label*="List"]').first().click()) },
  { name: 'cars-find-me', path: '/cars/', scope: '#find-me-a-car', run: (p) => p.locator('#find-me-a-car').scrollIntoViewIfNeeded() },
  { name: 'home-search', path: '/', scope: 'app-search-widget, .pf-search', run: (p) => btn(p, /Filters/i).click({ timeout: 3000 }).catch(() => {}) },
  { name: 'sell-form', path: '/sell-your-car/', steps: true, scope: 'main', run: (p) => p.locator('main').first().scrollIntoViewIfNeeded() },
  { name: 'part-exchange-page', path: '/part-exchange/', steps: true, scope: 'main', run: (p) => p.locator('main').first().scrollIntoViewIfNeeded() },
  { name: 'contact-form-errors', path: '/contact/', scope: 'form', run: async (p) => { await p.locator('form button[type=submit]').first().click(); } },
  { name: 'finance-calculator', path: '/finance/', scope: 'main', run: (p) => p.locator('main').first().scrollIntoViewIfNeeded() },
  { name: 'faq-open', path: '/faq/', scope: 'main', run: async (p) => { const s = p.locator('main summary, main button[aria-expanded]'); for (let i = 0; i < Math.min(await s.count(), 4); i++) await s.nth(i).click(); } },
  { name: 'compare-two', path: '/cars/', run: async (p) => { const c = p.locator('button[aria-label^="Add to compare"]'); await c.nth(0).click(); await c.nth(1).click(); await p.waitForTimeout(400); } },
  { name: 'compare-page', path: '/compare/', pre: async (p) => { await p.goto(BASE + '/cars/'); const c = p.locator('button[aria-label^="Add to compare"]'); await c.nth(0).click(); await c.nth(1).click(); await p.goto(BASE + '/compare/'); }, scope: 'main', run: () => {} },
  { name: 'saved-page', path: '/saved/', pre: async (p) => { await p.goto(BASE + `/vehicle/${CAR}/`); await btn(p, /^Save$/).click(); await p.goto(BASE + '/saved/'); }, scope: 'main', run: () => {} },
  { name: 'hub-login-error', path: '/hub', scope: 'main, form', run: async (p) => { const b = p.getByRole('button', { name: 'Sign in' }); if (await b.count()) await b.click(); } },
  { name: 'cookie-banner', path: '/', fresh: true, scope: '[aria-label=Cookies]', run: () => {} },
  { name: 'theme-picker', path: '/', scope: '[data-theme-picker] [role=group]', run: (p) => p.getByRole('button', { name: 'Change website theme' }).click(), desktopOnly: true },
  { name: 'menu-theme', path: '/', scope: '[aria-label="Website theme"]', run: (p) => p.getByRole('button', { name: /Toggle menu/i }).click(), mobileOnly: true },
];

const SCENARIOS = ONLY ? SCENARIOS_ALL.filter((s) => ONLY.includes(s.name)) : SCENARIOS_ALL;

function checks(scopeSel) {
  const out = [];
  const vw = document.documentElement.clientWidth;
  const dialog = [...document.querySelectorAll('[role=dialog][aria-modal=true], .viewer[role=dialog]')].find((d) => d.getBoundingClientRect().height > 0);
  const scopes = dialog ? [dialog] : scopeSel ? [...document.querySelectorAll(scopeSel)].filter((e) => e.getBoundingClientRect().height > 0) : [document.body];
  if (!scopes.length) return ['scope not found: ' + scopeSel];
  const name = (e) => {
    const t = (e.innerText || e.value || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 32);
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.name ? '[' + e.name + ']' : ''}${t ? ` "${t}"` : ''}`;
  };
  const shown = (e) => {
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    if (e.closest('.sr-only, [aria-hidden=true], [data-overlay]')) return false;
    // Answers inside a closed <details> are hidden but still report a box
    if (e.closest('details:not([open])') && !e.closest('summary')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const hasText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  for (const scope of scopes) {
    const sr = scope.getBoundingClientRect();
    // Popup taller than the screen and not scrollable → bottom unreachable
    if (dialog) {
      const panel = [...dialog.querySelectorAll('*')].find((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 2);
      const tallest = [...dialog.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().height), 0);
      if (!panel && tallest > innerHeight + 2 && !/(auto|scroll)/.test(getComputedStyle(dialog).overflowY)) out.push(`popup ${Math.round(tallest)}px tall on a ${innerHeight}px screen and cannot scroll`);
    }
    const items = [...scope.querySelectorAll('input:not([type=hidden]), select, textarea, button, a, label, p, h1, h2, h3, h4, li, span, dt, dd, td, th, legend, summary, small, strong')]
      .filter((e) => shown(e) && (/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.tagName) || hasText(e)));
    const rects = items.map((e) => [e, e.getBoundingClientRect()]);
    for (const [e, r] of rects) {
      const inScroller = (() => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; return false; })();
      if (!inScroller && (r.right > vw + 1 || r.left < -1)) out.push(`off screen: ${name(e)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      if (scope !== document.body && (r.right > sr.right + 2 || r.left < sr.left - 2)) {
        let clippedByScroller = false;
        for (let p = e.parentElement; p && p !== scope; p = p.parentElement) if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) clippedByScroller = true;
        if (!clippedByScroller) out.push(`pokes out of its box: ${name(e)}`);
      }
      const s = getComputedStyle(e);
      if (hasText(e) && s.textOverflow !== 'ellipsis' && /(hidden|clip)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 2) out.push(`text cut off: ${name(e)}`);
    }
    // Overlaps between things that are not nested in each other
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const [a, ra] = rects[i];
        const [b, rb] = rects[j];
        if (a.contains(b) || b.contains(a)) continue;
        if (a.closest('label') && a.closest('label') === b.closest('label')) continue;
        if ((a.tagName === 'LABEL' && a.control === b) || (b.tagName === 'LABEL' && b.control === a)) continue;
        // Text that wraps onto several lines has a big outer box; compare its real line boxes.
        const boxes = (el, r) => (getComputedStyle(el).display === 'inline' ? [...el.getClientRects()] : [r]);
        const hit = boxes(a, ra).some((x) => boxes(b, rb).some((y) => Math.min(x.right, y.right) - Math.max(x.left, y.left) > 3 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 3));
        if (hit) {
          // Sticky popup headers scroll over content by design
          const sticky = (el) => { for (let p = el; p && p !== scope; p = p.parentElement) if (getComputedStyle(p).position === 'sticky') return true; return false; };
          if (sticky(a) !== sticky(b)) continue;
          // Fixed bars (header, floating WhatsApp, compare tray) float over the page by design
          const fixed = (el) => { for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return p; return null; };
          if (fixed(a) !== fixed(b)) continue;
          out.push(`overlap: ${name(a)} × ${name(b)}`);
        }
      }
    }
    // Fields side by side in one row should be the same height
    const fields = rects.filter(([e]) => /^(INPUT|SELECT)$/.test(e.tagName) && !/checkbox|radio|range/.test(e.type));
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const [a, ra] = fields[i];
        const [b, rb] = fields[j];
        if (Math.abs(ra.top - rb.top) < 30 && Math.abs(ra.height - rb.height) > 3) out.push(`uneven fields in a row: ${name(a)} ${Math.round(ra.height)}px vs ${name(b)} ${Math.round(rb.height)}px`);
      }
    }
  }
  return [...new Set(out)];
}

const report = [];
for (const engine of ENGINES) {
  const browser = engine === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const mobile = width < 768;
      for (const sc of SCENARIOS) {
        if (sc.mobileOnly && !mobile) continue;
        // Desktop-only (the header picker shows from 1024px; a desktop scrollbar can eat a few px)
        if (sc.desktopOnly && width < 1100) continue;
        const context = await browser.newContext({
          viewport: { width, height: mobile ? 740 : 1000 },
          isMobile: mobile,
          hasTouch: mobile,
          colorScheme: theme,
          deviceScaleFactor: 2,
        });
        // SITE_THEME=prestige checks the Prestige site theme (THEMES is light/dark)
        await context.addInitScript(([fresh, dark, site]) => {
          try {
            if (!fresh) localStorage.setItem('cookieConsent', 'accepted');
            localStorage.setItem('darkMode', dark ? 'true' : 'false');
            if (site) localStorage.setItem('dlTheme', site);
          } catch {}
        }, [!!sc.fresh, theme === 'dark', process.env.SITE_THEME || '']);
        const page = await context.newPage();
        const tag = `${engine}@${width}-${theme}:${sc.name}`;
        let issues = [];
        try {
          if (sc.pre) await sc.pre(page);
          else await page.goto(BASE + sc.path, { waitUntil: 'networkidle' });
          await page.waitForTimeout(500);
          await sc.run(page);
          await page.waitForTimeout(700);
          issues = await page.evaluate(checks, sc.scope || null);
          // Walk multi-step forms: press Next until it stops, checking each step
          if (sc.steps) {
            for (let step = 2; step <= 6; step++) {
              const next = page.getByRole('button', { name: /^Next|Continue/ }).filter({ visible: true }).first();
              if (!(await next.count())) break;
              // Fill visible empty fields with harmless test values so Next is allowed
              for (const f of await page.locator('input:visible, select:visible, textarea:visible').all()) {
                const type = await f.getAttribute('type');
                if (await f.evaluate((e) => e.tagName === 'SELECT')) { await f.selectOption({ index: 1 }).catch(() => {}); continue; }
                if (type === 'checkbox' || type === 'radio' || type === 'file' || (await f.inputValue().catch(() => 'x'))) continue;
                const v = type === 'email' ? 'test@example.test' : type === 'tel' ? '07700900123' : type === 'number' ? '45000' : type === 'date' ? '2027-01-15' : 'Test';
                await f.fill(v).catch(() => {});
              }
              await next.click().catch(() => {});
              await page.waitForTimeout(500);
              issues.push(...(await page.evaluate(checks, sc.scope || null)).map((i) => `step ${step}: ${i}`));
            }
          }
        } catch (err) {
          issues.push(`could not run: ${String(err.message).split('\n')[0].slice(0, 120)}`);
        }
        const file = `${OUT}/${engine}-${width}-${theme}-${sc.name}.png`;
        await page.screenshot({ path: file }).catch(() => {});
        report.push({ engine, width, theme, scenario: sc.name, issues, file });
        if (issues.length) console.log(`${tag}: ${issues.length}\n  - ${[...new Set(issues)].slice(0, 10).join('\n  - ')}`);
        await context.close();
      }
    }
  }
  await browser.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
const total = report.reduce((n, r) => n + r.issues.length, 0);
console.log(`\n${total} issue(s) across ${report.length} popup/form views. Screenshots in ${OUT}`);
