import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Load Fengate/DriveLine stock from `src/app/data/vehicles.data.ts` (npm run sync:stock).
 * @param {string} dealerId
 */
export function loadDrivelineVehicles(dealerId) {
  const file = join(ROOT, 'src/app/data/vehicles.data.ts');
  const raw = readFileSync(file, 'utf8');
  const match = raw.match(/export const VEHICLES[^=]*=\s*(\[[\s\S]*\]);/);
  if (!match) {
    throw new Error(`Could not parse VEHICLES from ${file}`);
  }
  /** @type {Record<string, unknown>[]} */
  const vehicles = JSON.parse(match[1]);
  return vehicles.map((v) => ({
    ...v,
    dealerId,
    status: 'live',
  }));
}
