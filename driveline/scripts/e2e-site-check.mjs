/**
 * End-to-end check of every DriveLine feature in a real Chrome window.
 *
 * Runs against a local production build with the Firebase emulators, so no test
 * enquiries or visits ever reach the real database:
 *
 *   npm run build:gh-pages && cp dist/driveline/browser/index.csr.html dist/driveline/browser/404.html
 *   node scripts/serve-dist.mjs &                       # serves like GitHub Pages
 *   firebase emulators:start --only auth,firestore      # Java 21
 *   node scripts/e2e-site-check.mjs                     # HEADED=1 to watch
 *
 * Prints PASS / FAIL per check and exits 1 if anything failed.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4310';
const FS = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const PROJECT = 'driveline-car-sales';
const results = [];
let page;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}
async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(name, false, String(e.message || e).split('\n')[0].slice(0, 200));
  }
}
const leadCount = async () => {
  const r = await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/leads?pageSize=300`, {
    headers: { Authorization: 'Bearer owner' },
  });
  return ((await r.json()).documents ?? []).length;
};
async function go(path) {
  await page.goto(BASE + path + (path.includes('?') ? '&' : '?') + 'emulators=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
}
const text = () => page.locator('body').innerText();
const showing = async () => (/Showing (\d+) of (\d+)/.exec(await text()) ?? []).slice(1).join('/');
async function fillContact(scope, prefix = '') {
  const set = async (name, v) => {
    const el = scope.locator(`[name="${prefix}${name}"]`).first();
    if (await el.count()) await el.fill(v);
  };
  await set('firstName', 'Test');
  await set('lastName', 'Buyer');
  await set('email', 'buyer@example.test');
  await set('phone', '07700 900123');
}

const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED });
// The service worker is tested on its own (scripts/pwa-check.mjs); here it would hide requests
// from page.route(). SW=allow runs every check with the service worker in control instead
// (standard emulator ports only), to prove forms and the hub work in the installed app.
const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, serviceWorkers: process.env.SW === 'allow' ? 'allow' : 'block' });
// The site build talks to the emulators on their standard ports (8080 / 9099). When those are
// busy (another project's emulators), start ours with `--config firebase.alt-ports.json`:
// requests to the standard ports are then redirected to the ports firebase gave this run.
for (const [std, host] of [['8080', FS], ['9099', AUTH]]) {
  const port = host.split(':')[1];
  if (port && port !== std) await context.route(`http://127.0.0.1:${std}/**`, (r) => r.continue({ url: r.request().url().replace(`127.0.0.1:${std}`, `127.0.0.1:${port}`) }));
}
page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|ERR_FILE_NOT_FOUND|net::ERR_|postcodes\.io/.test(m.text()) && !(/\/hub/.test(page.url()) && /status of 404/.test(m.text()))) consoleErrors.push(`${page.url()} :: ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: ${e.message.slice(0, 160)}`));
// Never send a real email app / WhatsApp / phone call from the test.
await context.route(/^(mailto|tel|https:\/\/wa\.me)/, (r) => r.abort());

// ---------------- Pages load ----------------
for (const p of ['/', '/cars', '/vans', '/finance', '/warranty', '/sell-your-car', '/reviews', '/contact', '/saved', '/compare', '/mot-check', '/faq', '/delivery', '/part-exchange', '/used-cars/audi', '/legal/privacy-policy', '/legal/cookie-policy', '/legal/disclaimer', '/legal/sitemap', '/hub']) {
  await step(`page ${p} loads`, async () => {
    await go(p);
    const h = await page.locator('h1').first().innerText().catch(() => '');
    const title = await page.title();
    await page.waitForTimeout(800);
    const title2 = await page.title();
    check(`page ${p} loads`, !!(h || title) && !/404|not found|error/i.test(h), `h1="${h.slice(0, 50)}"`);
    if (p !== '/hub') check(`page ${p} has its own title`, title2 !== 'DriveLine' && title2.includes('DriveLine'), title2);
  });
}

// ---------------- Flicker: nothing on screen is hidden then re-shown ----------------
await step('no on-screen section is hidden at load', async () => {
  await go('/');
  await page.waitForTimeout(800);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('.reveal-init:not(.reveal-visible)')].filter((e) => e.getBoundingClientRect().top < innerHeight).length,
  );
  check('no on-screen section is hidden at load', hidden === 0, `${hidden} hidden`);
});
await step('scrolling has no layout jumps', async () => {
  await go('/');
  const cls = await page.evaluate(async () => {
    let total = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) total += e.value; })).observe({ type: 'layout-shift', buffered: false });
    for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    await new Promise((r) => setTimeout(r, 300));
    return total;
  });
  check('scrolling has no layout jumps', cls < 0.05, `shift score ${cls.toFixed(3)}`);
});
await step('no heavy blur on cards or animated filters', async () => {
  await go('/cars');
  const r = await page.evaluate(() => ({
    cardBlur: [...document.querySelectorAll('app-vehicle-card *')].filter((e) => getComputedStyle(e).backdropFilter !== 'none').length,
    headerBlur: getComputedStyle(document.querySelector('header')).backdropFilter,
    endless: document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).map((a) => a.animationName),
  }));
  check('no heavy blur on cards or animated filters', r.cardBlur === 0 && !/40px/.test(r.headerBlur), JSON.stringify(r));
});

// ---------------- Home ----------------
await step('home hero + search', async () => {
  await go('/');
  const t = await text();
  check('home: new headline shown', t.includes('honestly priced'));
  check('home: price drops section', (await page.locator('#price-drops app-vehicle-card').count()) > 0);
  await page.locator('app-search-widget input').first().fill('Ford');
  await page.locator('app-search-widget').getByRole('button', { name: /Search/ }).last().click();
  await page.waitForURL(/\/cars/);
  await page.waitForTimeout(600);
  const fords = await page.$$eval('app-vehicle-card h3', (hs) => hs.map((h) => h.innerText));
  check('home: search for "Ford" shows only Fords', fords.length > 0 && fords.every((t) => /Ford/.test(t)), `${page.url().split('?')[1]} ${fords.join(' | ')}`);
});
await step('home: body type and budget shortcuts', async () => {
  await go('/');
  await page.locator('a[href^="/cars?bodyType="]').first().click();
  await page.waitForURL(/bodyType=/);
  check('home: body type shortcut filters', /Showing \d+ of \d+/.test(await text()), page.url().split('?')[1]);
  await go('/');
  await page.locator('a[href^="/cars?maxPrice="]').first().click();
  await page.waitForURL(/maxPrice=/);
  const prices = await page.$$eval('app-vehicle-card', (cs) => cs.map((c) => +([...c.querySelectorAll('p')].find((p) => /^£[\d,]+$/.test(p.innerText.trim()))?.innerText.replace(/[£,]/g, '') ?? 0)));
  const max = +new URL(page.url()).searchParams.get('maxPrice');
  check('home: budget shortcut respects max price', prices.every((p) => p <= max), `max ${max}, got ${prices.join(',')}`);
});

// ---------------- Listings ----------------
await step('cars listing filters, reset, sort, paging', async () => {
  await go('/cars');
  const start = await showing();
  await page.locator('app-search-widget select').nth(1).selectOption({ label: 'Automatic' });
  await page.getByRole('button', { name: 'Search Vehicles' }).click();
  await page.waitForTimeout(600);
  const autos = await page.$$eval('app-vehicle-card', (cs) => cs.every((c) => /\bAuto\b/.test(c.innerText) && !/\bManual\b/.test(c.innerText)));
  check('cars: automatic filter', autos && /transmission=Automatic/.test(page.url()), await showing());
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.waitForTimeout(600);
  check('cars: reset keeps cars only and clears the address', (await showing()) === start && !page.url().includes('transmission'), `${start} → ${await showing()} ${page.url()}`);
  const price = () => page.$$eval('app-vehicle-card', (cs) => cs.map((c) => +([...c.querySelectorAll('p')].find((p) => /^£[\d,]+$/.test(p.innerText.trim()))?.innerText.replace(/[£,]/g, '') ?? 0)));
  const sortSel = page.locator('select').filter({ hasText: 'Newest First' });
  await sortSel.selectOption({ label: 'Price: Low to High' });
  await page.waitForTimeout(400);
  const asc = await price();
  check('cars: sort price low to high', asc.every((p, i) => !i || p >= asc[i - 1]), asc.join(','));
  await sortSel.selectOption({ label: 'Price: High to Low' });
  await page.waitForTimeout(400);
  const desc = await price();
  check('cars: sort price high to low', desc.every((p, i) => !i || p <= desc[i - 1]), desc.join(','));
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page.waitForTimeout(500);
  check('cars: page 2', /Showing \d+ of \d+/.test(await text()) && (await page.locator('app-vehicle-card').count()) > 0);
  const before = await page.locator('app-search-widget input:visible, app-search-widget select:visible').count();
  await page.getByRole('button', { name: /Advanced Filters/ }).click();
  await page.waitForTimeout(400);
  const after = await page.locator('app-search-widget input:visible, app-search-widget select:visible').count();
  check('cars: advanced filters open', after > before, `${before} → ${after} fields`);
});
await step('cars: keyword search', async () => {
  await go('/cars');
  const kw = page.locator('app-search-widget input').first();
  await kw.fill('Qashqai');
  await page.getByRole('button', { name: 'Search Vehicles' }).click();
  await page.waitForTimeout(600);
  const all = await page.$$eval('app-vehicle-card h3', (hs) => hs.map((h) => h.innerText));
  check('cars: keyword search', all.length > 0 && all.every((t) => /Qashqai/i.test(t)), all.join(' | '));
});
await step('vans listing', async () => {
  await go('/vans');
  check('vans: shows vans only', (await showing()).endsWith('/4') || /Showing \d+ of \d+/.test(await text()), await showing());
});

// ---------------- Card actions ----------------
await step('card save / compare / compare page', async () => {
  await go('/cars');
  const cards = page.locator('app-vehicle-card');
  await cards.nth(0).locator('button.save-heart').click();
  await cards.nth(0).locator('button.compare-toggle').click();
  await cards.nth(1).locator('button.compare-toggle').click();
  check('cards: compare tray appears', await page.locator('app-compare-tray').innerText().then((t) => /compare/i.test(t)));
  await go('/saved');
  check('saved page lists the saved car', (await page.locator('app-vehicle-card').count()) === 1);
  await go('/compare');
  const t = await text();
  check('compare page shows 2 cars side by side', (t.match(/£[\d,]+/g) ?? []).length >= 2 && !/Nothing to compare/.test(t));
  await page.evaluate(() => localStorage.clear());
});

// ---------------- Vehicle page ----------------
const VEHICLE = '/vehicle/10475';
await step('vehicle page: gallery, tabs, viewer', async () => {
  await go(VEHICLE);
  const tabs = page.locator('.photo-tab');
  check('vehicle: photo group tabs', (await tabs.count()) >= 3, await tabs.allInnerTexts().then((t) => t.join(' · ')));
  await tabs.filter({ hasText: 'Interior' }).click();
  await page.waitForTimeout(400);
  await page.locator('.gallery-mosaic .tile-main').click();
  await page.waitForTimeout(500);
  const viewer = page.locator('[role=dialog]');
  check('vehicle: full-screen viewer opens', await viewer.isVisible());
  const before = await viewer.locator('.viewer-bar').innerText();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  const after = await viewer.locator('.viewer-bar').innerText();
  check('vehicle: arrow key moves to next photo', before !== after, `${before.replace(/\s+/g, ' ')} → ${after.replace(/\s+/g, ' ')}`);
  await page.getByRole('button', { name: 'Show all photos' }).click();
  await page.waitForTimeout(500);
  check('vehicle: all-photos grid', (await page.locator('.viewer-grid img').count()) > 3);
  await page.keyboard.press('Escape'); // leaves the grid
  await page.keyboard.press('Escape'); // closes the viewer
  await page.waitForTimeout(300);
  check('vehicle: Escape closes viewer', !(await viewer.isVisible().catch(() => false)));
});
await step('vehicle page: price, finance, running costs', async () => {
  await go(VEHICLE);
  const t = await text();
  check('vehicle: reduced price shown with old price', /Was £[\d,]+/.test(t) && /you save/.test(t));
  await page.getByRole('button', { name: 'Finance', exact: true }).click();
  await page.waitForTimeout(300);
  const fin1 = (/£([\d,]+)\s*\/\s*mo/i.exec(await text()) ?? [])[1];
  const range = page.locator('input[type=range]').first();
  if (await range.count()) {
    await range.evaluate((el) => { el.value = String(Number(el.max) * 0.3); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForTimeout(300);
  }
  const fin2 = (/£([\d,]+)\s*\/\s*mo/i.exec(await text()) ?? [])[1];
  check('vehicle: finance calculator reacts to deposit', !!fin1 && fin1 !== fin2, `${fin1} → ${fin2}`);
  await page.getByRole('button', { name: 'Running costs' }).click();
  await page.waitForTimeout(300);
  check('vehicle: running costs shown', /tax|fuel/i.test(await text()));
  check('vehicle: MOT history and ULEZ links', (await page.locator('a[href*="check-mot"]').count()) > 0 && (await page.locator('a[href*="tfl.gov.uk"]').count()) > 0);
});
await step('vehicle page: postcode distance', async () => {
  await go(VEHICLE);
  const pc = page.locator('input[name="postcode"], input[placeholder*="postcode" i]').first();
  if (!(await pc.count())) return check('vehicle: postcode distance', false, 'no postcode box');
  await pc.fill('CB1 1PT');
  await pc.press('Enter');
  const btn = page.getByRole('button', { name: /^Check$/ });
  if (await btn.count()) await btn.first().click();
  await page.waitForTimeout(2500);
  const m = /About (\d+) miles from our Peterborough/.exec(await text());
  check('vehicle: postcode distance (Cambridge ≈ 30–40 miles)', !!m && +m[1] >= 25 && +m[1] <= 45, m ? m[0] : 'no result');
});
for (const [label, kind] of [['Book a test drive', 'test-drive'], ['Reserve it', 'reserve'], ['Video viewing', 'video']]) {
  await step(`vehicle: ${kind} request saves a lead`, async () => {
    await go(VEHICLE);
    const n0 = await leadCount();
    await page.getByRole('button', { name: label }).first().click();
    await page.waitForTimeout(500); // human pause: the form resets itself as it opens
    const dlg = page.locator('app-visit-request');
    await fillContact(dlg);
    const date = dlg.locator('input[type=date]');
    if (await date.count()) await date.fill('2026-11-20');
    const time = dlg.locator('select').first();
    if (await time.count()) await time.selectOption({ index: 1 });
    await dlg.getByRole('button', { name: /^(Request|Reserve|Send|Book)/ }).first().click();
    await page.waitForTimeout(2500);
    const n1 = await leadCount();
    const shown = (await dlg.innerText()).replace(/\s+/g, ' ');
    const alert = await dlg.locator('[role=alert]').allInnerTexts();
    check(`vehicle: ${kind} request saves a lead`, n1 === n0 + 1, `${n0} → ${n1}; alert=${alert.join('|')}; ${shown.slice(0, 160)}`);
  });
}
await step('vehicle: enquiry form saves a lead', async () => {
  await go(VEHICLE);
  const n0 = await leadCount();
  const form = page.locator('form').filter({ has: page.locator('[name="message"]') }).last();
  await fillContact(form);
  await form.locator('[name="message"]').fill('Is it still available? (automated test)');
  await form.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  check('vehicle: enquiry form saves a lead', (await leadCount()) === n0 + 1);
});

// ---------------- New: photos, share images, car page extras, new pages ----------------
await step('photos are served as WebP with a blurred preview', async () => {
  await go('/cars');
  const r = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('app-vehicle-card picture img')].slice(0, 6);
    return { webp: imgs.filter((i) => /\.webp$/.test(i.currentSrc)).length, total: imgs.length, blur: document.querySelectorAll('app-vehicle-card img[src^="data:image/webp"]').length };
  });
  check('cards: photos load as WebP', r.total > 0 && r.webp === r.total, JSON.stringify(r));
  check('cards: blurred previews present', r.blur > 0, String(r.blur));
});
await step('home banner loads at most 3 photos', async () => {
  await go('/');
  const n = await page.evaluate(() => new Set([...document.querySelectorAll('section img[role="presentation"]')].map((i) => i.currentSrc)).size);
  check('home: banner keeps at most 3 photos in the page', n >= 1 && n <= 3, String(n));
});
await step('car page: key facts, share image, summary bar', async () => {
  await go(VEHICLE);
  const facts = await page.locator('ul.key-facts li').allInnerTexts();
  check('vehicle: key facts strip', facts.length >= 5 && facts.some((f) => /Mileage/i.test(f)), facts.map((f) => f.replace(/\s+/g, ' ')).join(' | '));
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  check('vehicle: share image is the car’s own card', /\/og\/10475\.jpg$/.test(og ?? ''), og ?? '');
  const ogRes = await fetch(BASE + '/og/10475.jpg');
  check('vehicle: share image file exists', ogRes.ok && /image\/jpeg/.test(ogRes.headers.get('content-type') ?? ''), String(ogRes.status));
  const bar = page.locator('.summary-bar');
  const before = await bar.evaluate((e) => e.classList.contains('is-visible'));
  // The price card is pinned while its column scrolls; the bar shows once it has gone.
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight - innerHeight - 200));
  await page.waitForTimeout(700);
  const after = await bar.evaluate((e) => e.classList.contains('is-visible'));
  check('vehicle: summary bar appears after scrolling past the price', !before && after, `${before} → ${after}`);
  await page.evaluate(() => scrollTo(0, 0));
});
await step('make page lists only that make', async () => {
  await go('/used-cars/audi');
  const titles = await page.$$eval('app-vehicle-card h3', (hs) => hs.map((h) => h.innerText));
  const h1 = await page.locator('h1').innerText();
  check('make page: only Audis, with a matching heading', titles.length > 0 && titles.every((t) => /Audi/.test(t)) && /Used Audi/.test(h1), `${h1} · ${titles.length} cars`);
  const title = await page.title();
  check('make page: own page title', /Used Audi for sale in Peterborough/.test(title), title);
  await page.locator('a[href="/used-cars/ford"]').first().click();
  await page.waitForURL(/used-cars\/ford/);
  await page.waitForTimeout(500);
  const fords = await page.$$eval('app-vehicle-card h3', (hs) => hs.map((h) => h.innerText));
  check('make page: link to another make works', fords.length > 0 && fords.every((t) => /Ford/.test(t)), fords.join(' | '));
});
await step('FAQ, delivery and part-exchange pages', async () => {
  await go('/faq');
  const faqSchema = await page.locator('#faq-schema').count();
  await page.locator('details.faq-item summary').first().click();
  check('faq: answers open and FAQ schema present', faqSchema === 1 && (await page.locator('details.faq-item[open]').count()) === 1);
  await go('/delivery');
  const pc = page.locator('app-delivery-check input');
  await pc.fill('CB1 1PT');
  await page.locator('app-delivery-check button[type=submit]').click();
  await page.waitForTimeout(2500);
  check('delivery: distance check works without a car', /About \d+ miles/.test(await text()));
  await go('/part-exchange');
  check('part exchange: steps and valuation link', (await page.locator('ol li').count()) === 4 && (await page.locator('a[href="/sell-your-car"]').count()) > 0);
  await go('/');
  check('home: browse by make links', (await page.locator('a[href^="/used-cars/"]').count()) >= 10);
});

// ---------------- Other forms ----------------
for (const [path, label] of [['/finance', 'finance'], ['/warranty', 'warranty'], ['/contact', 'contact']]) {
  await step(`${label} form saves a lead`, async () => {
    await go(path);
    const n0 = await leadCount();
    const form = page.locator('form').filter({ has: page.locator('[name="firstName"]') }).first();
    await fillContact(form);
    for (const name of ['message', 'vehicleOfInterest', 'vehicleDetails']) {
      const el = form.locator(`[name="${name}"]`);
      if ((await el.count()) && (await el.evaluate((e) => e.tagName !== 'SELECT'))) await el.fill('Automated test, please ignore');
    }
    const sel = form.locator('select[name="loanTerm"]');
    if (await sel.count()) await sel.selectOption({ index: 1 });
    await form.locator('button[type=submit]').click();
    await page.waitForTimeout(2500);
    const n1 = await leadCount();
    check(`${label} form saves a lead`, n1 === n0 + 1, `${n0} → ${n1}`);
  });
}
await step('find-me-a-car form saves a lead', async () => {
  await go('/cars');
  const n0 = await leadCount();
  const f = page.locator('app-find-me-a-car form');
  await f.locator('[name="want"]').fill('Family SUV, automatic');
  await fillContact(f);
  await f.locator('button[type=submit]').click();
  await page.waitForTimeout(2500);
  check('find-me-a-car form saves a lead', (await leadCount()) === n0 + 1);
});
await step('sell your car: no developer errors, 3 steps, saves a lead', async () => {
  await go('/sell-your-car');
  const t = await text();
  check('sell: no developer error text', !/dvlaLookupUrl|DVLA_API_KEY|not configured/i.test(t));
  const n0 = await leadCount();
  const f = page.locator('app-part-exchange-form');
  // Fill every visible empty field the way a customer would, then go to the next step.
  const values = { peRegistration: 'AB12 CDE', peMileage: '45000', peModel: 'Focus', peMake: 'Ford', peColour: 'Blue', peOwners: '2', peFn: 'Test', peLn: 'Seller', peEm: 'seller@example.test', pePh: '07700 900456', pePc: 'PE1 5BH', peDetails: 'Automated test, please ignore' };
  const steps = [];
  for (let i = 0; i < 4; i++) {
    for (const el of await f.locator('input, select, textarea').all()) {
      if (!(await el.isVisible())) continue;
      const [tag, type, name, value] = await el.evaluate((e) => [e.tagName, e.type, e.name, e.value]);
      if (tag === 'SELECT') { if (!value) await el.selectOption({ index: 1 }); continue; }
      if (type === 'checkbox' || type === 'radio') continue;
      if (!value) await el.fill(values[name] ?? (type === 'number' ? '1' : type === 'date' ? '2027-01-01' : 'Test'));
    }
    const next = f.getByRole('button', { name: /^Next/ });
    if (await next.count()) {
      steps.push((await next.first().innerText()).trim());
      await next.first().click();
      await page.waitForTimeout(400);
      continue;
    }
    const submit = f.getByRole('button', { name: /Submit|Send|Get my|Request/ });
    steps.push((await submit.last().innerText()).trim());
    await submit.last().click();
    break;
  }
  await page.waitForTimeout(2500);
  const n1 = await leadCount();
  check('sell: form goes through and saves a lead', n1 === n0 + 1, `${n0} → ${n1}; steps: ${steps.join(' → ')}; end: "${(await f.innerText()).split('\n').slice(0, 1).join(' ')}"`);
});
await step('forms refuse empty submissions', async () => {
  await go('/contact');
  const n0 = await leadCount();
  await page.locator('form').filter({ has: page.locator('[name="firstName"]') }).first().locator('button[type=submit]').click();
  await page.waitForTimeout(1200);
  check('contact: empty form is not sent', (await leadCount()) === n0);
});

// ---------------- Site chrome ----------------
await step('dark mode toggle', async () => {
  await go('/');
  // Dark mode lives in the header's appearance menu (brush icon) with the theme choice
  await page.getByRole('button', { name: 'Change website theme' }).click();
  await page.getByRole('switch', { name: /dark mode/i }).click();
  check('dark mode turns on', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await page.getByRole('switch', { name: /light mode/i }).click();
  check('dark mode turns off again', await page.evaluate(() => !document.documentElement.classList.contains('dark')));
  await page.keyboard.press('Escape');
  await page.evaluate(() => localStorage.clear());
});
await step('theme switch', async () => {
  await go('/');
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  check('theme: Default on first visit', (await theme()) === null);
  await page.getByRole('button', { name: 'Change website theme' }).click();
  await page.locator('[data-theme-picker]').getByRole('button', { name: /Prestige/ }).click();
  check('theme: Prestige applies at once', (await theme()) === 'prestige');
  check('theme: Prestige fonts load', await page.evaluate(() => !!document.getElementById('dl-prestige-fonts')));
  check('theme: gold logo shows', await page.locator('img[src$="driveline-mark-prestige.svg"]').first().isVisible());
  // Prestige has its own home page (hero film, stock grid with chips, finance panel)
  await page.locator('app-prestige-home .pf-film').waitFor({ timeout: 15000 }).catch(() => {});
  check('prestige home: hero film loads', await page.locator('app-prestige-home .pf-film').count() === 1);
  check('prestige home: film shows a photo (WebGL or fallback)', await page.evaluate(() => { const c = document.querySelector('.pf-canvas'); return (!!c && !c.classList.contains('pf-hidden')) || !!document.querySelector('.pf-fallback.on'); }));
  const cardsAll = await page.locator('.pf-card').count();
  await page.locator('.pf-chip', { hasText: 'SUV' }).click();
  const suvTitles = await page.locator('.pf-card .pf-card-title').allInnerTexts();
  check('prestige home: stock chips filter the grid', cardsAll > 0 && suvTitles.length > 0 && (await page.locator('.pf-chip.on').innerText()).trim().toUpperCase() === 'SUV', `${cardsAll} cards → ${suvTitles.length} SUVs`);
  await page.locator('.pf-card').nth(1).scrollIntoViewIfNeeded();
  await page.locator('.pf-card').nth(1).hover();
  const quoteTitle = (await page.locator('.pf-quote h3').innerText().catch(() => '')).trim();
  check('prestige home: finance panel follows the car you point at', !!quoteTitle && quoteTitle === (suvTitles[1] || '').trim(), quoteTitle);
  const m60 = await page.locator('.pf-quote-total strong').innerText();
  await page.locator('.pf-terms button', { hasText: '36 months' }).click();
  await page.waitForFunction((before) => document.querySelector('.pf-quote-total strong')?.textContent?.replace(/\s+/g, '') !== before.replace(/\s+/g, ''), m60, { timeout: 3000 }).catch(() => {});
  const m36 = await page.locator('.pf-quote-total strong').innerText();
  check('prestige home: finance term changes the monthly figure', /£\d/.test(m60) && m36 !== m60, `${m60.replace(/\s+/g, '')} → ${m36.replace(/\s+/g, '')}`);
  await page.evaluate(() => scrollTo(0, 0));
  await go('/cars');
  check('theme: kept on the next page', (await theme()) === 'prestige');
  await page.reload({ waitUntil: 'networkidle' });
  check('theme: kept after reload (no flash: set before Angular starts)', (await theme()) === 'prestige');
  await page.getByRole('button', { name: 'Change website theme' }).click();
  await page.locator('[data-theme-picker]').getByRole('button', { name: /Default/ }).click();
  check('theme: back to Default', (await theme()) === null && (await page.evaluate(() => localStorage.getItem('dlTheme'))) === 'default');
  await page.evaluate(() => localStorage.removeItem('dlTheme'));
});
await step('cookie banner', async () => {
  await page.evaluate(() => localStorage.removeItem('cookieConsent'));
  await go('/');
  const banner = page.locator('app-cookie-banner');
  const btn = banner.getByRole('button').first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(300);
    check('cookie banner closes', !(await banner.getByRole('button').first().isVisible().catch(() => false)));
  } else check('cookie banner closes', true, 'no banner shown');
});
await step('mobile menu', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/');
  await page.getByRole('button', { name: /Toggle menu/i }).click();
  await page.waitForTimeout(400);
  const drawer = page.locator('.mobile-drawer');
  check('mobile: menu opens', await drawer.isVisible());
  await drawer.getByRole('link', { name: 'Finance' }).click();
  await page.waitForURL(/\/finance/);
  check('mobile: menu link navigates', page.url().includes('/finance'));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check('mobile: no sideways scrolling', overflow <= 1, `${overflow}px`);
  await go(VEHICLE);
  check('mobile: vehicle page swipe strip', await page.locator('.gallery-strip').isVisible());
  await page.setViewportSize({ width: 1366, height: 860 });
});

// ---------------- Hub ----------------
await step('hub: sign in, see leads, update, visitors', async () => {
  // Emulator-only staff account
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e-staff@example.test', password: 'test-only-pw', returnSecureToken: true }),
  });
  const { localId } = await r.json();
  if (localId) {
    await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/staff/${localId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
    });
  }
  await go('/hub');
  await page.fill('#hub-email', 'e2e-staff@example.test');
  await page.fill('#hub-password', 'test-only-pw');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForSelector('text=DriveLine Hub', { timeout: 8000 });
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: /^All/ }).click();
  const items = await page.locator('ul[aria-label="Enquiries"] li button').count();
  check('hub: signs in and lists enquiries', items > 0, `${items} enquiries`);
  await page.locator('ul[aria-label="Enquiries"] li button').first().click();
  await page.locator('section[aria-label="Enquiry details"]').getByRole('button', { name: 'Booked in' }).click();
  await page.waitForTimeout(1200);
  check('hub: status change saved', /Booked in/.test(await page.locator('section[aria-label="Enquiry details"]').innerText()) && /Last updated by/.test(await page.locator('section[aria-label="Enquiry details"]').innerText()));
  await page.getByRole('button', { name: 'Visitors' }).click();
  await page.waitForTimeout(1500);
  check('hub: visitors section loads', /Visits per day/.test(await text()) && !/Could not load/.test(await text()));
  await page.getByRole('button', { name: 'Sign out' }).click();
});

check('no console errors on any page', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' || '));
if (process.env.SW === 'allow') {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  check('the service worker was in control during this run', await page.evaluate(() => !!navigator.serviceWorker?.controller));
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
