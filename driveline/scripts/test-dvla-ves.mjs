#!/usr/bin/env node
/**
 * Optional live check against DVLA Vehicle Enquiry Service (VES).
 *
 * Usage:
 *   DVLA_API_KEY=your-key node scripts/test-dvla-ves.mjs [VRN]
 *   DVLA_API_KEY=... DVLA_TEST_VRN=AB12CDE node scripts/test-dvla-ves.mjs
 *
 * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html
 */

const VES_URL =
  'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';

const apiKey = process.env.DVLA_API_KEY?.trim();
const rawVrn =
  process.argv[2] || process.env.DVLA_TEST_VRN || 'AB12CDE';
const registrationNumber = String(rawVrn).replace(/\s+/g, '').toUpperCase();

if (!apiKey) {
  console.log(
    '[test-dvla-ves] Skipped: set DVLA_API_KEY to run a live VES request.',
  );
  process.exit(0);
}

const res = await fetch(VES_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-api-key': apiKey,
  },
  body: JSON.stringify({ registrationNumber }),
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error('[test-dvla-ves] HTTP', res.status, body);
  process.exit(1);
}

if (!body || typeof body !== 'object' || !body.registrationNumber) {
  console.error('[test-dvla-ves] Unexpected success payload:', body);
  process.exit(1);
}

console.log('[test-dvla-ves] OK', {
  registrationNumber: body.registrationNumber,
  make: body.make ?? '—',
  taxStatus: body.taxStatus ?? '—',
  motStatus: body.motStatus ?? '—',
});
process.exit(0);
