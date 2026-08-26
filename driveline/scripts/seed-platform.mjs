/**
 * Reset platform JSON store to seed data (includes DriveLine / drivelinecarsales.co.uk).
 * Usage: npm run seed:platform
 * Refresh committed snapshot after stock sync: npm run export:platform-snapshot
 */
import { resetToSeed } from '../platform/store.mjs';

const snap = resetToSeed();
const driveline = snap.dealers.find((d) => d.slug === 'driveline');
const stock = snap.vehicles.filter((v) => v.dealerId === 'dealer_driveline');
console.log(
  `Seeded ${snap.dealers.length} dealers, ${snap.vehicles.length} vehicles total.`,
);
if (driveline) {
  console.log(
    `DriveLine (${driveline.customDomains.join(', ')}): ${stock.length} vehicles, ${snap.reviews.filter((r) => r.dealerId === 'dealer_driveline').length} reviews.`,
  );
}
