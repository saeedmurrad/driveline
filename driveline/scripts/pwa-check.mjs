/**
 * Checks the installable-app (PWA) side of a production build, in Chrome:
 *  - web manifest: names, colours, icons (incl. maskable), shortcuts, every file present
 *  - the service worker registers, saves the app and takes control of the page
 *  - with a connection, pages still come fresh from the network (the prerendered HTML)
 *  - with NO connection: home, stock list, a car page, the MOT check and an unknown address open
 *  - the offline notice shows and goes away again
 *  - install button: appears on the browser's install event and opens the prompt;
 *    iPhone shows the two steps; nothing is offered inside the installed app
 *  - new version: a tab that is already on it stays quiet; an old tab moves to the new
 *    version on its next page change
 *
 *   npm run build:gh-pages && cp dist/driveline/browser/index.csr.html dist/driveline/browser/404.html
 *   node scripts/pwa-check.mjs        (DIST=dist/e2e-vehicle-check/browser for another build)
 *
 * It runs its own small server (port 4312) so it can "cut the connection" and "deploy a new
 * version" (a second set of files laid over the build) without touching the build itself.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(fileURLToPath(new URL('..', import.meta.url)), process.env.DIST || 'dist/driveline/browser');
const PORT = Number(process.env.PORT || 4312);
const BASE = `http://127.0.0.1:${PORT}`;
const CAR = process.env.CAR || '10541';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json',
};

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Waits until something matching the selector is actually visible (pages can hold a hidden twin, e.g. a phone-only heading). */
const waitVisible = (page, selector, timeout = 15000) =>
  page.waitForFunction((sel) => [...document.querySelectorAll(sel)].some((el) => el.getClientRects().length > 0), selector, { timeout });
async function until(fn, ms = 20000, step = 250) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(step);
  }
}

// ---- the server: the build, optionally with a "new deploy" laid over it, optionally unreachable ----
let down = false;
/** { dir, removed:Set<path> } — files of a newer version; `removed` are files that deploy deleted. */
let overlay = null;
function fileFor(path) {
  if (overlay) {
    if (overlay.removed.has(path)) return null;
    const o = join(overlay.dir, path);
    if (existsSync(o) && statSync(o).isFile()) return o;
    if (existsSync(join(o, 'index.html'))) return join(o, 'index.html');
  }
  const f = join(ROOT, path);
  if (existsSync(f) && statSync(f).isFile()) return f;
  if (existsSync(join(f, 'index.html'))) return join(f, 'index.html');
  return null;
}
const server = createServer((req, res) => {
  if (down) return void req.socket.destroy();
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = fileFor(path);
  let status = 200;
  if (!file) {
    file = fileFor('/404.html');
    status = 404;
  }
  res.writeHead(status, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

if (!existsSync(join(ROOT, 'ngsw.json'))) {
  console.log(`FAIL  ${ROOT} has no ngsw.json: build with the production configuration first`);
  process.exit(1);
}

// ---- 1. manifest and page head ----
const manifest = await (await fetch(`${BASE}/site.webmanifest`)).json();
check('manifest: name and short name', manifest.name?.length > 3 && manifest.short_name?.length <= 12, `${manifest.name} / ${manifest.short_name}`);
check('manifest: opens as its own window from the home page', manifest.display === 'standalone' && manifest.start_url === '/' && manifest.scope === '/');
check('manifest: colours set', /^#[0-9a-f]{6}$/i.test(manifest.theme_color ?? '') && /^#[0-9a-f]{6}$/i.test(manifest.background_color ?? ''));
const icons = manifest.icons ?? [];
const has = (size, purpose) => icons.some((i) => i.sizes === size && (i.purpose ?? 'any').split(' ').includes(purpose));
check('manifest: 192 and 512 icons', has('192x192', 'any') && has('512x512', 'any'));
check('manifest: maskable icon for Android', has('512x512', 'maskable') && !icons.some((i) => /any maskable|maskable any/.test(i.purpose ?? '')));
let iconsOk = true;
const iconNotes = [];
for (const i of icons) {
  const r = await fetch(BASE + i.src);
  if (r.status !== 200) { iconsOk = false; iconNotes.push(`${i.src} ${r.status}`); continue; }
  if (i.type === 'image/png') {
    const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
    if (`${m.width}x${m.height}` !== i.sizes) { iconsOk = false; iconNotes.push(`${i.src} is ${m.width}x${m.height}`); }
  }
}
check('manifest: every icon file exists at its stated size', iconsOk, iconNotes.join(', '));
let shortcutsOk = (manifest.shortcuts ?? []).length >= 3;
for (const s of manifest.shortcuts ?? []) if ((await fetch(BASE + s.url)).status !== 200) shortcutsOk = false;
check('manifest: shortcuts open real pages', shortcutsOk, (manifest.shortcuts ?? []).map((s) => s.url).join(' '));
const home = readFileSync(join(ROOT, 'index.html'), 'utf8');
check('page head: manifest, theme colour, iPhone icon, app-capable', /rel="manifest"/.test(home) && /name="theme-color"/.test(home) && /rel="apple-touch-icon"/.test(home) && /name="mobile-web-app-capable"/.test(home));

// ---- 2. what the service worker is told to keep ----
const ngsw = JSON.parse(readFileSync(join(ROOT, 'ngsw.json'), 'utf8'));
const table = Object.keys(ngsw.hashTable ?? {});
const appGroup = ngsw.assetGroups.find((g) => g.name === 'app');
check('saved copy: boots from the empty app shell, pages fetched fresh', ngsw.index === '/index.csr.html' && ngsw.navigationRequestStrategy === 'freshness', `${ngsw.index} ${ngsw.navigationRequestStrategy}`);
check('saved copy: all scripts and styles are kept', appGroup.urls.includes('/index.csr.html') && appGroup.urls.filter((u) => u.endsWith('.js')).length > 20 && appGroup.urls.some((u) => u.endsWith('.css')), `${appGroup.urls.length} files`);
check('saved copy: stock photos are not listed one by one', !table.some((u) => u.startsWith('/stock/')) && ngsw.dataGroups.some((g) => g.name === 'stock-photos'), `${table.length} files listed, ngsw.json ${Math.round(statSync(join(ROOT, 'ngsw.json')).size / 1024)} kB`);

const browser = await chromium.launch({ channel: 'chrome', headless: !process.env.HEADED });
const errors = [];
async function newPage(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 860 }, ...options });
  await context.addInitScript(() => {
    try { localStorage.setItem('cookieConsent', 'declined'); } catch {}
    window.__sw = [];
    navigator.serviceWorker?.addEventListener('message', (e) => window.__sw.push(e.data?.type));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page };
}
const { context, page } = await newPage();

// ---- 3. registration ----
await page.goto(`${BASE}/`, { waitUntil: 'load' });
const registerStart = Date.now();
const active = await page.evaluate(() => Promise.race([navigator.serviceWorker.ready.then((r) => !!r.active), new Promise((r) => setTimeout(() => r(false), 45000))]));
check('service worker registers and activates', active, `${((Date.now() - registerStart) / 1000).toFixed(1)}s after the page loaded`);
const controlled = await until(() => page.evaluate(() => !!navigator.serviceWorker.controller), 15000);
check('service worker takes control of the open page', !!controlled);
const saved = await until(() => page.evaluate(async (want) => {
  let n = 0;
  for (const k of await caches.keys()) if (k.includes(':assets:app:cache')) n += (await (await caches.open(k)).keys()).length;
  return n >= want ? n : 0;
}, appGroup.urls.length), 90000, 500);
check('the whole app is saved on the device', !!saved, `${saved || 0}/${appGroup.urls.length} files`);

// ---- 4. online: fresh pages ----
for (const path of ['/cars/', `/vehicle/${CAR}/`]) {
  const r = await page.goto(BASE + path, { waitUntil: 'load' });
  const html = await r.text();
  check(`online ${path}: page comes fresh from the network, through the service worker`, r.fromServiceWorker() && /ng-server-context/.test(html));
}

// ---- 5. offline ----
await page.goto(`${BASE}/vehicle/${CAR}/`, { waitUntil: 'networkidle' });
await sleep(1500); // let the photos of this car be saved
down = true;
await context.setOffline(true);
const offlinePages = [
  ['/', 'h1'],
  ['/cars/', 'app-vehicle-card'],
  [`/vehicle/${CAR}/`, 'h1'],
  ['/mot-check', 'app-reg-search, h1'],
  ['/finance/', 'h1'],
  ['/contact/', 'h1'],
  ['/no-such-page-here', 'h1, h2'],
];
for (const [path, selector] of offlinePages) {
  let ok = false, detail = '';
  try {
    const r = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await waitVisible(page, `app-root :is(${selector})`);
    const text = (await page.locator('app-root main').innerText()).trim();
    ok = r.fromServiceWorker() && text.length > 80;
    detail = `${text.length} characters of content`;
  } catch (e) {
    detail = String(e.message).split('\n')[0];
  }
  check(`offline ${path} opens from the saved copy`, ok, detail);
}
await page.goto(`${BASE}/vehicle/${CAR}/`, { waitUntil: 'domcontentloaded' });
await waitVisible(page, 'app-root h1');
check('offline: the notice is shown', await page.getByText('You’re offline').isVisible().catch(() => false));
const photo = await until(() => page.evaluate(() => [...document.images].some((i) => /\/stock\//.test(i.currentSrc) && i.complete && i.naturalWidth > 0)), 8000);
check('offline: photos already seen for this car still show', !!photo);
// In-app page change while offline (lazy page code must come from the saved copy)
await page.locator('header a[href="/finance"]').first().click().catch(() => {});
const financeOffline = await until(() => page.evaluate(() => location.pathname.startsWith('/finance') && !!document.querySelector('app-root main h1')), 10000);
check('offline: moving to another page inside the app works', !!financeOffline);

down = false;
await context.setOffline(false);
check('back online: the notice goes away', !!(await until(async () => !(await page.getByText('You’re offline').isVisible()), 5000)));

// ---- 6. install button ----
const fireInstallEvent = () => page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted = true; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await sleep(800);
const installButton = page.getByRole('button', { name: 'Install the DriveLine app' });
check('install: no button until the browser says the app can be installed', (await installButton.count()) === 0);
const prevented = await fireInstallEvent();
check('install: button appears in the footer (and the browser pop-up bar is held back)', prevented && (await until(() => installButton.first().isVisible(), 5000)));
await installButton.first().click();
check('install: the button opens the browser install prompt', await page.evaluate(() => window.__prompted === true));
check('install: the button goes away once used', !!(await until(async () => (await installButton.count()) === 0, 5000)));

// Inside the installed app (opened from the home screen) nothing is offered
{
  const app = await newPage({ serviceWorkers: 'block' });
  await app.context.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  });
  await app.page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(800);
  await app.page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true })));
  await sleep(600);
  check('install: not offered inside the installed app', (await app.page.getByRole('button', { name: 'Install the DriveLine app' }).count()) === 0);
  await app.context.close();
}

// iPhone: steps instead of a prompt, in the footer and in the menu
{
  const iphone = await newPage({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  await iphone.page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(800);
  const footerBtn = iphone.page.locator('app-footer').getByRole('button', { name: 'Install the DriveLine app' });
  await footerBtn.scrollIntoViewIfNeeded().catch(() => {});
  check('iPhone: install button shown in the footer', await footerBtn.isVisible().catch(() => false));
  await footerBtn.click().catch(() => {});
  check('iPhone: the button shows the Share and Add to Home Screen steps', !!(await until(() => iphone.page.locator('app-footer').getByText('Add to Home Screen').isVisible(), 5000)));
  await iphone.page.evaluate(() => scrollTo(0, 0));
  await iphone.page.getByRole('button', { name: /Toggle menu/i }).click();
  const menuBtn = iphone.page.locator('header').getByRole('button', { name: 'Install the DriveLine app' });
  check('iPhone: install button shown in the menu', !!(await until(() => menuBtn.isVisible(), 5000)));
  // The menu must fit the screen (it scrolls inside itself), so its last button can be reached
  const reach = await iphone.page.evaluate(async () => {
    const d = document.querySelector('.mobile-drawer');
    d.scrollTop = d.scrollHeight;
    await new Promise((r) => setTimeout(r, 100));
    const last = [...d.querySelectorAll('a, button')].at(-1).getBoundingClientRect();
    return { bottom: Math.round(d.getBoundingClientRect().bottom), lastBottom: Math.round(last.bottom), screen: innerHeight };
  });
  check('iPhone: the whole menu fits the screen and its last button can be reached', reach.bottom <= reach.screen + 1 && reach.lastBottom <= reach.screen + 1, JSON.stringify(reach));
  await iphone.context.close();
}

// ---- 7. a new version goes live ----
const mainFile = appGroup.urls.find((u) => /^\/main-[A-Z0-9]{8}\.js$/.test(u));
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');
const newManifest = (edit) => {
  const m = JSON.parse(readFileSync(join(ROOT, 'ngsw.json'), 'utf8'));
  m.timestamp = Date.now();
  edit?.(m);
  return JSON.stringify(m, null, 2);
};
const waitForVersionReady = async () => {
  await page.evaluate(() => { window.__sw.length = 0; navigator.serviceWorker.controller.postMessage({ action: 'CHECK_FOR_UPDATES', nonce: Math.floor(Math.random() * 1e7) }); });
  return until(() => page.evaluate(() => window.__sw.includes('VERSION_READY')), 60000, 300);
};
const clickFinance = async () => {
  await page.evaluate(() => { window.__sameDocument = true; });
  await page.locator('header a[href="/finance"]').first().click();
  await until(() => page.evaluate(() => location.pathname.startsWith('/finance') && !!document.querySelector('app-root main h1')), 15000);
  return page.evaluate(() => window.__sameDocument === true);
};

// 7a. Same files, new deploy: this tab is already on the newest files, so nothing to do.
await page.goto(`${BASE}/cars/`, { waitUntil: 'networkidle' });
await sleep(800);
const dirA = mkdtempSync(join(tmpdir(), 'dl-pwa-a-'));
writeFileSync(join(dirA, 'ngsw.json'), newManifest());
overlay = { dir: dirA, removed: new Set() };
check('new version (same files): picked up', !!(await waitForVersionReady()));
await sleep(1500);
check('new version (same files): the tab is left alone, no reload', (await clickFinance()) === true);

// 7b. New files, old tab: the next page change loads the new version in full.
await page.goto(`${BASE}/cars/`, { waitUntil: 'networkidle' });
await sleep(800);
const dirB = mkdtempSync(join(tmpdir(), 'dl-pwa-b-'));
const newMain = '/main-PWATEST1.js';
writeFileSync(join(dirB, newMain), readFileSync(join(ROOT, mainFile)));
for (const rel of ['index.csr.html', '404.html', 'index.html', 'cars/index.html', 'finance/index.html']) {
  mkdirSync(dirname(join(dirB, rel)), { recursive: true });
  writeFileSync(join(dirB, rel), readFileSync(join(ROOT, rel), 'utf8').replaceAll(mainFile.slice(1), newMain.slice(1)));
}
writeFileSync(join(dirB, 'ngsw.json'), newManifest((m) => {
  for (const g of m.assetGroups) g.urls = g.urls.map((u) => (u === mainFile ? newMain : u));
  m.hashTable[newMain] = m.hashTable[mainFile];
  delete m.hashTable[mainFile];
  m.hashTable['/index.csr.html'] = sha1(readFileSync(join(dirB, 'index.csr.html')));
}));
overlay = { dir: dirB, removed: new Set([mainFile]) };
check('new version (new files): downloaded in the background', !!(await waitForVersionReady()));
await sleep(1500);
const sameDocument = await clickFinance();
const scripts = await page.evaluate(() => [...document.scripts].map((s) => s.getAttribute('src') ?? '').filter((s) => s.startsWith('main-')));
check('new version (new files): the next page change loads the new version', sameDocument === false && scripts.includes(newMain.slice(1)), `full load: ${!sameDocument}, running ${scripts.join(', ')}`);
check('new version (new files): the page works after the move', (await page.locator('app-root main h1').count()) > 0 && page.url().includes('/finance'));
overlay = null;

check('no script errors during the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
server.close();
server.closeAllConnections?.();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} PWA checks passed`);
process.exit(failed ? 1 : 0);
