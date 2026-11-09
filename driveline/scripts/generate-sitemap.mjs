/**
 * Writes public/sitemap.xml: the main pages plus one entry per vehicle in stock.
 * Runs before the GitHub Pages build so the sitemap always matches the stock file.
 *
 * Usage: node scripts/generate-sitemap.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://drivelinecarsales.co.uk';

const pages = [
  ['/', 'daily', '1.0'],
  ['/cars', 'daily', '0.9'],
  ['/vans', 'daily', '0.9'],
  ['/finance', 'weekly', '0.7'],
  ['/warranty', 'monthly', '0.6'],
  ['/sell-your-car', 'monthly', '0.7'],
  ['/reviews', 'weekly', '0.6'],
  ['/contact', 'monthly', '0.7'],
  ['/legal/privacy-policy', 'yearly', '0.3'],
  ['/legal/cookie-policy', 'yearly', '0.3'],
  ['/legal/disclaimer', 'yearly', '0.3'],
  ['/legal/sitemap', 'monthly', '0.3'],
];

const data = readFileSync(join(ROOT, 'src/app/data/vehicles.data.ts'), 'utf8');
const START = 'export const VEHICLES: Vehicle[] = ';
const from = data.indexOf(START) + START.length;
// Sold cars keep their page for a few days but are not offered to search engines.
const ids = JSON.parse(data.slice(from, data.indexOf('];', from) + 1))
  .filter((v) => v.status !== 'sold')
  .map((v) => v.id);

const entry = (path, freq, priority) =>
  `  <url>\n    <loc>${SITE}${path}</loc>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...pages.map(([p, f, pr]) => entry(p, f, pr)),
  ...ids.map((id) => entry(`/vehicle/${encodeURIComponent(id)}`, 'weekly', '0.8')),
  '</urlset>',
  '',
].join('\n');

writeFileSync(join(ROOT, 'public/sitemap.xml'), xml);
console.log(`sitemap.xml: ${pages.length} pages + ${ids.length} vehicles`);
