/**
 * Runs the REAL vehicle check worker (workers/dvla-ves-proxy/worker.js) locally on
 * http://127.0.0.1:4320, with stand-in DVLA and DVSA servers behind it that answer in
 * the official formats. Used by the end-to-end check; no real API is called.
 *
 *   node scripts/mock-vehicle-apis.mjs
 *
 * Known registrations: LB15WMA (2015 Mini Countryman, stock 10541). Anything else → 404.
 */
import { createServer } from 'node:http';
import worker from '../workers/dvla-ves-proxy/worker.js';

const PORT = 4320;
const SELF = `http://127.0.0.1:${PORT}`;

const dvla = {
  LB15WMA: {
    registrationNumber: 'LB15WMA', taxStatus: 'Taxed', taxDueDate: '2026-08-01', motStatus: 'Valid', motExpiryDate: '2026-07-20',
    make: 'MINI', yearOfManufacture: 2015, engineCapacity: 1995, co2Emissions: 161, fuelType: 'DIESEL', colour: 'GREEN',
    monthOfFirstRegistration: '2015-07', euroStatus: 'EURO 5',
  },
};
const mot = {
  LB15WMA: {
    registration: 'LB15WMA', make: 'MINI', model: 'COUNTRYMAN', firstUsedDate: '2015-07-21', fuelType: 'Diesel', primaryColour: 'Green',
    registrationDate: '2015-07-21', manufactureDate: '2015-07-01', engineSize: '1995', hasOutstandingRecall: 'No',
    motTests: [
      { registrationAtTimeOfTest: 'LB15WMA', completedDate: '2025-07-16T10:00:00.000Z', testResult: 'PASSED', expiryDate: '2026-07-20', odometerValue: '86812', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '100000000003', dataSource: 'DVSA', defects: [{ text: 'Nearside rear tyre worn close to legal limit (5.2.3 (e))', type: 'ADVISORY', dangerous: false }] },
      { registrationAtTimeOfTest: 'LB15WMA', completedDate: '2025-07-15T10:00:00.000Z', testResult: 'FAILED', expiryDate: null, odometerValue: '86800', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '100000000002', dataSource: 'DVSA', defects: [{ text: 'Offside front brake pad(s) less than 1.5 mm thick (1.1.13 (a) (ii))', type: 'MAJOR', dangerous: false }] },
      { registrationAtTimeOfTest: 'LB15WMA', completedDate: '2024-07-10T10:00:00.000Z', testResult: 'PASSED', expiryDate: '2025-07-20', odometerValue: '79010', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '100000000001', dataSource: 'DVSA', defects: [] },
      { registrationAtTimeOfTest: 'LB15WMA', completedDate: '2023-07-12T10:00:00.000Z', testResult: 'PASSED', expiryDate: '2024-07-20', odometerValue: '70150', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '100000000000', dataSource: 'DVSA', defects: [{ text: 'Front brake discs worn, pitted or scored, but not seriously weakened (1.1.14 (a) (ii))', type: 'ADVISORY', dangerous: false }] },
    ],
  },
};

const env = {
  DVLA_API_KEY: 'mock', MOT_CLIENT_ID: 'mock', MOT_CLIENT_SECRET: 'mock', MOT_API_KEY: 'mock',
  MOT_TOKEN_URL: `${SELF}/__fake/token`, DVLA_URL: `${SELF}/__fake/dvla`, MOT_BASE: `${SELF}/__fake/mot/`,
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  const url = new URL(req.url, SELF);

  // Stand-in upstream APIs
  if (url.pathname === '/__fake/token') return send(res, 200, { token_type: 'Bearer', expires_in: 1199, access_token: 'mock-token' });
  if (url.pathname === '/__fake/dvla') {
    const vrm = JSON.parse(raw || '{}').registrationNumber;
    return dvla[vrm] ? send(res, 200, dvla[vrm]) : send(res, 404, { errors: [{ status: '404', title: 'Vehicle Not Found' }] });
  }
  if (url.pathname.startsWith('/__fake/mot/')) {
    const vrm = decodeURIComponent(url.pathname.slice('/__fake/mot/'.length));
    return mot[vrm] ? send(res, 200, mot[vrm]) : send(res, 404, { errorCode: 'MOTH-NF-01', errorMessage: 'The vehicle requested has not been found' });
  }

  // Everything else goes through the real worker
  const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : raw });
  const r = await worker.fetch(request, env, {});
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`Vehicle check worker (mock upstreams) on ${SELF}`));
