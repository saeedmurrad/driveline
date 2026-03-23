/**
 * Pulls live used car + van stock from Fengate Car Sales (fengatecarsales.co.uk)
 * via their public /v1/vehicles/stock/{id} API (same as the dealer website).
 *
 * Usage: npm run sync:stock
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src/app/data/vehicles.data.ts');

const ORIGIN = 'https://www.fengatecarsales.co.uk';
const UA = 'Mozilla/5.0 (compatible; DriveLineStockSync/1.0; +https://fengatecarsales.co.uk)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Extract stock IDs embedded in listing page (pageConfig). */
function extractVehicleIds(html) {
  const m = html.match(/vehicle_ids\\":\[([^\]]+)\]/);
  if (!m) return [];
  return [...m[1].matchAll(/\d+/g)].map((x) => x[0]);
}

function absImagePath(path) {
  if (!path || typeof path !== 'string') return '';
  if (path.startsWith('http')) return path.replace('https:/www.', 'https://www.');
  return ORIGIN + path;
}

function mapFuelType(api) {
  const raw = `${api.fuel_type_display || ''} ${api.engine || ''} ${api.fuel_type || ''}`.toLowerCase();
  if (raw.includes('plug') || raw.includes('phev') || raw.includes('plug-in')) return 'Plug-in Hybrid';
  if (raw.includes('electric') && !raw.includes('hybrid')) return 'Electric';
  if (raw.includes('hybrid')) return 'Hybrid';
  if (raw.includes('diesel')) return 'Diesel';
  return 'Petrol';
}

function mapTransmission(api) {
  const t = `${api.transmission_display || ''} ${api.gearbox || ''}`.toLowerCase();
  return t.includes('auto') ? 'Automatic' : 'Manual';
}

function mapServiceHistory(api) {
  let s = (api.service_history || '').toLowerCase();
  if (!s) s = (api.description || '').toLowerCase();
  if (s.includes('full service')) return 'Full';
  if (s.includes('full') && s.includes('history')) return 'Full';
  if (s.includes('part') || s.includes('some service') || (s.includes('service') && s.includes('history'))) return 'Part';
  return 'None';
}

function formatMot(api) {
  if (!api.mot_expiry) return 'TBC';
  const d = new Date(api.mot_expiry);
  if (Number.isNaN(d.getTime())) return 'TBC';
  return d.toISOString().slice(0, 10);
}

function formatDateAdded(api) {
  const raw = api.date_added || api.source_last_modified;
  if (!raw) return new Date().toISOString().slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function splitFeatures(api) {
  if (typeof api.features === 'string' && api.features.trim()) {
    return api.features
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 80);
  }
  return [];
}

function mapToVehicle(api) {
  const category = api.vehicle_type === 'van' ? 'van' : 'car';
  const images = (api.images || [])
    .map((img) => absImagePath(img.i800x600 || img.i850x638 || img.full))
    .filter(Boolean);
  const thumb = images[0] || '';

  const engineL =
    api.engine_capacity != null && api.engine_capacity > 0
      ? Math.round((api.engine_capacity / 1000) * 10) / 10
      : 1.0;

  const doors = typeof api.doors === 'number' && api.doors > 0 ? api.doors : 5;
  const owners = typeof api.owner_count === 'number' ? api.owner_count : 0;

  const seg = api.vehicle_type === 'van' ? 'vans' : 'cars';
  const slug = `${api.manufacturer}-${api.model}-${api.derivative}-${api.id}`;
  const sourceListingUrl = `${ORIGIN}/used/${seg}/${slug}/`;

  const v = {
    id: String(api.id),
    make: api.manufacturer_display || capitalize(api.manufacturer || 'Unknown'),
    model: api.model_display || capitalize(api.model || ''),
    derivative: api.derivative_display || api.derivative || '',
    year: api.year_built || new Date().getFullYear(),
    price: Math.round(Number(api.price) || 0),
    mileage: Math.round(Number(api.mileage) || 0),
    transmission: mapTransmission(api),
    fuelType: mapFuelType(api),
    engineSize: engineL,
    doors,
    colour: api.colour || api.basic_colour_display || '—',
    bodyType: api.body_name || api.body_type_display || '—',
    category,
    description: decodeEntities(api.description || '').trim() || `${api.year_built} ${api.manufacturer_display} ${api.model_display}`,
    features: splitFeatures(api),
    images: images.length ? images : [thumb].filter(Boolean),
    thumbnailImage: thumb,
    registration: api.vrm || undefined,
    previousOwners: owners,
    motExpiry: formatMot(api),
    serviceHistory: mapServiceHistory(api),
    co2Emissions: api.co2 != null ? Math.round(api.co2) : undefined,
    mpg: api.mpg != null ? Math.round(api.mpg) : undefined,
    bhp: api.bhp != null ? Math.round(api.bhp) : undefined,
    topSpeedMph: api.max_speed != null ? Math.round(api.max_speed) : undefined,
    dateAdded: formatDateAdded(api),
    sourceListingUrl,
  };

  if (api.monthly_price != null && !Number.isNaN(Number(api.monthly_price))) {
    v.monthlyPrice = Math.round(Number(api.monthly_price));
  } else {
    const ill = illustrativeMonthlyPayment(v.price);
    if (ill != null) v.monthlyPrice = ill;
  }
  if (typeof api.seats === 'number' && api.seats > 0) v.seats = api.seats;
  if (api.tax_rate_12 != null && !Number.isNaN(Number(api.tax_rate_12))) {
    v.taxRate12Month = Math.round(Number(api.tax_rate_12));
  }
  if (api.urban_mpg != null) v.mpgUrban = Math.round(Number(api.urban_mpg));
  if (api.extra_urban_mpg != null) v.mpgExtraUrban = Math.round(Number(api.extra_urban_mpg));
  if (api.height != null) v.heightMm = Math.round(Number(api.height));
  if (api.length != null) v.lengthMm = Math.round(Number(api.length));
  if (api.width != null) v.widthMm = Math.round(Number(api.width));
  if (api.boot_space_seats_up != null) {
    v.bootSpaceSeatsUpLitres = Math.round(Number(api.boot_space_seats_up));
  }
  if (api.boot_space_seats_down != null) {
    v.bootSpaceSeatsDownLitres = Math.round(Number(api.boot_space_seats_down));
  }
  if (api.acceleration != null) {
    v.acceleration0To60Seconds = Math.round(Number(api.acceleration) * 10) / 10;
  }

  return v;
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ');
}

/** Illustrative HP when API omits monthly_price (48mo, 10% dep, 9.9% APR rep.) */
function illustrativeMonthlyPayment(cashPrice) {
  const price = Number(cashPrice);
  if (!Number.isFinite(price) || price < 500) return undefined;
  const termMonths = 48;
  const representativeApr = 9.9;
  const depositPercent = 10;
  const deposit = price * (depositPercent / 100);
  const principal = Math.max(0, price - deposit);
  const monthlyRate = representativeApr / 100 / 12;
  const n = termMonths;
  if (monthlyRate <= 0) return Math.round(principal / n);
  const pow = Math.pow(1 + monthlyRate, n);
  const payment = (principal * monthlyRate * pow) / (pow - 1);
  if (!Number.isFinite(payment) || payment <= 0) return undefined;
  return Math.round(payment);
}

function decodeEntities(html) {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&#43;/g, '+')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function main() {
  console.log('Fetching listing pages…');
  const [carsHtml, vansHtml] = await Promise.all([
    fetchText(`${ORIGIN}/used/cars/`),
    fetchText(`${ORIGIN}/used/vans/`),
  ]);

  const carIds = extractVehicleIds(carsHtml);
  const vanIds = extractVehicleIds(vansHtml);
  const allIds = [...new Set([...carIds, ...vanIds])];

  console.log(`Found ${carIds.length} car IDs, ${vanIds.length} van IDs (${allIds.length} unique).`);

  const vehicles = [];
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    process.stdout.write(`\r  Stock ${id} (${i + 1}/${allIds.length})…`);
    try {
      const api = await fetchJson(`${ORIGIN}/v1/vehicles/stock/${id}`);
      if (api.sold === true) {
        console.log(`\n  Skip ${id} (sold).`);
        continue;
      }
      vehicles.push(mapToVehicle(api));
    } catch (e) {
      console.error(`\n  Failed ${id}:`, e.message);
    }
    await sleep(120);
  }

  console.log(`\nBuilt ${vehicles.length} vehicles.`);

  // Feature first 6 newest (by dateAdded) on home
  vehicles.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  vehicles.slice(0, 6).forEach((v) => {
    v.isFeatured = true;
  });

  const json = JSON.stringify(vehicles, null, 2);
  const file = `import { Vehicle } from '../models/vehicle.model';

/**
 * Live stock mirrored from Fengate Car Sales (fengatecarsales.co.uk).
 * Regenerate: \`npm run sync:stock\`
 */
export const VEHICLES: Vehicle[] = ${json};

/** Derived filter options from current stock */
export const MAKES = [...new Set(VEHICLES.map((v) => v.make))].sort((a, b) =>
  a.localeCompare(b)
);
export const FUEL_TYPES = [...new Set(VEHICLES.map((v) => v.fuelType))].sort((a, b) =>
  a.localeCompare(b)
);
export const TRANSMISSIONS = [...new Set(VEHICLES.map((v) => v.transmission))].sort((a, b) =>
  a.localeCompare(b)
);
export const DOOR_OPTIONS = [...new Set(VEHICLES.map((v) => v.doors))].sort((a, b) => a - b);
`;

  writeFileSync(OUT, file, 'utf8');
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
