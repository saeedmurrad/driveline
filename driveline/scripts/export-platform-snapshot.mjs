/**
 * Write platform/seed/platform.snapshot.json from current seed builders.
 * Run after sync:stock when Fengate inventory changes.
 * Usage: npm run export:platform-snapshot
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeedSnapshot } from '../platform/seed-data.mjs';

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '../platform/seed/platform.snapshot.json',
);

const snap = buildSeedSnapshot();
writeFileSync(out, JSON.stringify(snap, null, 2), 'utf8');

const drivelineStock = snap.vehicles.filter(
  (v) => v.dealerId === 'dealer_driveline',
).length;
console.log(
  `Wrote ${out} (${snap.dealers.length} dealers, ${snap.vehicles.length} vehicles, ${drivelineStock} DriveLine).`,
);
