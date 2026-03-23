#!/usr/bin/env node
/**
 * Capture full-page screenshots — laptop / desktop layout only (wide viewport).
 *
 * Prereqs:
 *   1. Terminal A: npm start   (app on http://localhost:4200)
 *   2. Once: npx playwright install chromium
 *
 * Run:
 *   npm run screenshots:client
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'handoff', 'screenshots');

const BASE = (process.env.BASE_URL || 'http://localhost:4200').replace(/\/$/, '');

/** Laptop viewport — keeps Tailwind lg/xl breakpoints in “desktop” range */
const VIEWPORT = { width: 1920, height: 1080 };

/** Desktop Chrome UA so the app never serves a mobile profile */
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** @type {{ name: string; path: string; home?: boolean }[]} */
const routes = [
  { name: '01-home', path: '/', home: true },
  { name: '02-used-cars', path: '/cars' },
  { name: '03-used-vans', path: '/vans' },
  { name: '04-vehicle-detail', path: '/vehicle/10370' },
  { name: '05-finance', path: '/finance' },
  { name: '06-warranty', path: '/warranty' },
  { name: '07-sell-your-car', path: '/sell-your-car' },
  { name: '08-reviews', path: '/reviews' },
  { name: '09-contact', path: '/contact' },
  { name: '10-legal-privacy', path: '/legal/privacy-policy' },
  { name: '11-legal-cookies', path: '/legal/cookie-policy' },
  { name: '12-legal-disclaimer', path: '/legal/disclaimer' },
  { name: '13-legal-sitemap', path: '/legal/sitemap' },
];

async function waitFonts(page) {
  await page.evaluate(async () => {
    try {
      if (document.fonts?.ready) await document.fonts.ready;
    } catch {
      /* ignore */
    }
  });
}

async function captureRoute(page, { name, path: routePath, home }) {
  const url = `${BASE}${routePath}`;
  await page.goto(url, {
    waitUntil: 'load',
    timeout: 90_000,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitFonts(page);

  // Force all scroll-reveal blocks visible (belt-and-suspenders vs IO timing in headless)
  await page.evaluate(() => {
    document.querySelectorAll('.reveal-init').forEach((el) => {
      el.classList.add('reveal-visible');
    });
  });

  if (home) {
    // Hero: wait for first slide image to be present and decode
    await page
      .waitForSelector('section img[src*="hero"]', { state: 'visible', timeout: 20_000 })
      .catch(() => {});
    const hero = page.locator('section img[src*="hero"]').first();
    if (await hero.count()) {
      try {
        await hero.evaluate((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 8000);
          });
        });
      } catch {
        /* continue */
      }
    }
    // Crossfade cycle + layout settle (hero looks mid-transition otherwise)
    await new Promise((r) => setTimeout(r, 3200));
  } else {
    await new Promise((r) => setTimeout(r, 900));
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  console.log(`Output:   ${outDir}`);
  console.log(`Base:     ${BASE}`);
  console.log(`Viewport: ${VIEWPORT.width}×${VIEWPORT.height} (laptop / desktop only)\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    userAgent: DESKTOP_UA,
    locale: 'en-GB',
    // Scroll-reveal CSS treats this like visible content + static hero (stable screenshots)
    reducedMotion: 'reduce',
  });

  // Scroll-reveal sections use .reveal-init { opacity: 0 } until IntersectionObserver runs;
  // in headless Chrome that often misses before capture → huge “empty” middle on home.

  // No cookie bar in shots (clean full-page captures)
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem('cookieConsent', 'accepted');
    } catch {
      /* ignore */
    }
  });

  const page = await context.newPage();

  for (const route of routes) {
    process.stdout.write(`${route.name} … `);
    try {
      await captureRoute(page, route);
      console.log('ok');
    } catch (e) {
      console.log('FAILED', e.message);
    }
  }

  await browser.close();
  console.log('\nDone. Zip `handoff/screenshots/` to share with your client.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
