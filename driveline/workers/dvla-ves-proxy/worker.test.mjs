// node --test workers/dvla-ves-proxy/worker.test.mjs   (no network: fetch is mocked)
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { compactMot, normaliseVrm, DVLA_URL, MOT_BASE } from './worker.js';

const SITE = 'https://drivelinecarsales.co.uk';
const env = {
  DVLA_API_KEY: 'dvla-key',
  MOT_CLIENT_ID: 'id', MOT_CLIENT_SECRET: 'secret', MOT_API_KEY: 'mot-key',
  MOT_TOKEN_URL: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
};
const req = (path, init = {}, origin = SITE) =>
  new Request('https://worker.test' + path, { ...init, headers: { ...(origin ? { Origin: origin } : {}), ...(init.headers || {}) } });

// Sample shaped exactly like VehicleWithMotResponse in dvsa-mot-history-openapi.yml
const motSample = {
  registration: 'LB15WMA', make: 'MINI', model: 'COUNTRYMAN', firstUsedDate: '2015-07-21', fuelType: 'Diesel',
  primaryColour: 'Green', engineSize: '1995', hasOutstandingRecall: 'No',
  motTests: [
    { completedDate: '2024-07-10T10:00:00.000Z', testResult: 'PASSED', expiryDate: '2025-07-20', odometerValue: '79000', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '1', dataSource: 'DVSA',
      defects: [{ text: 'Nearside front tyre worn close to legal limit', type: 'ADVISORY', dangerous: false }] },
    { completedDate: '2025-07-15T10:00:00.000Z', testResult: 'FAILED', expiryDate: null, odometerValue: '86500', odometerUnit: 'MI', odometerResultType: 'READ', motTestNumber: '2', dataSource: 'DVSA',
      defects: [{ text: 'Brake pad worn below 1.5 mm', type: 'MAJOR', dangerous: false }, { text: 'Wiper blade defective', type: 'MINOR' }] },
    { completedDate: '2025-07-16T10:00:00.000Z', testResult: 'PASSED', expiryDate: '2026-07-20', odometerValue: null, odometerUnit: null, odometerResultType: 'UNREADABLE', motTestNumber: '3', dataSource: 'DVSA', defects: [] },
  ],
};

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init, calls.length); };
  return calls;
}

test('normalises registrations', () => {
  assert.equal(normaliseVrm(' lb15 wma '), 'LB15WMA');
  assert.equal(normaliseVrm('x'), null);
  assert.equal(normaliseVrm('<script>'), 'SCRIPT'); // symbols stripped, never passed on
  assert.equal(normaliseVrm('ABCDEFGHIJ'), null); // too long
});

test('blocks other websites', async () => {
  const r = await worker.fetch(req('/mot/LB15WMA', {}, 'https://evil.example'), env);
  assert.equal(r.status, 403);
});

test('answers CORS preflight for the DriveLine site and localhost', async () => {
  for (const o of [SITE, 'http://localhost:4200', 'http://127.0.0.1:4310']) {
    const r = await worker.fetch(req('/', { method: 'OPTIONS' }, o), env);
    assert.equal(r.status, 204);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), o);
  }
});

test('DVLA: forwards with the server key only and never a key from the caller', async () => {
  const calls = mockFetch(() => new Response(JSON.stringify({ make: 'MINI', colour: 'GREEN' }), { status: 200 }));
  const r = await worker.fetch(req('/', { method: 'POST', body: JSON.stringify({ registrationNumber: 'lb15 wma' }), headers: { 'x-api-key': 'stolen' } }), env);
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, DVLA_URL);
  assert.equal(calls[0].init.headers['x-api-key'], 'dvla-key');
  assert.equal(JSON.parse(calls[0].init.body).registrationNumber, 'LB15WMA');
});

test('DVLA: 503 with a plain message when no key is set', async () => {
  const r = await worker.fetch(req('/', { method: 'POST', body: '{"registrationNumber":"AB12CDE"}' }), {});
  assert.equal(r.status, 503);
});

test('MOT: gets a token, calls DVSA with both headers, returns the compact history', async () => {
  const calls = mockFetch((url) =>
    url.includes('login.microsoftonline.com')
      ? new Response(JSON.stringify({ access_token: 'tok', expires_in: 1199 }), { status: 200 })
      : new Response(JSON.stringify(motSample), { status: 200 }),
  );
  const r = await worker.fetch(req('/mot/LB15WMA'), env);
  assert.equal(r.status, 200);
  const tokenCall = calls.find((c) => c.url.includes('login.microsoftonline.com'));
  assert.match(String(tokenCall.init.body), /grant_type=client_credentials/);
  assert.match(String(tokenCall.init.body), /scope=https%3A%2F%2Ftapi\.dvsa\.gov\.uk%2F\.default/);
  const apiCall = calls.find((c) => c.url.startsWith(MOT_BASE));
  assert.equal(apiCall.url, MOT_BASE + 'LB15WMA');
  assert.equal(apiCall.init.headers.Authorization, 'Bearer tok');
  assert.equal(apiCall.init.headers['X-API-Key'], 'mot-key');
  const body = await r.json();
  assert.equal(body.model, 'COUNTRYMAN');
  assert.equal(body.tests.length, 3);
  assert.equal(body.tests[0].date, '2025-07-16'); // newest first
  assert.equal(body.tests[1].result, 'fail');
  assert.deepEqual(body.tests[1].failures.map((f) => f.text), ['Brake pad worn below 1.5 mm']);
  assert.equal(body.tests[1].minors.length, 1);
  assert.deepEqual(body.tests[2].mileage, { value: 79000, unit: 'mi' });
  assert.equal(body.tests[0].mileage, null); // unreadable odometer
});

test('MOT: reuses the token for the next lookup', async () => {
  const calls = mockFetch(() => new Response(JSON.stringify(motSample), { status: 200 }));
  await worker.fetch(req('/mot/AB12CDE'), env);
  assert.equal(calls.filter((c) => c.url.includes('login.microsoftonline.com')).length, 0);
});

test('MOT: 404 when DVSA has no record, 503 when not set up', async () => {
  mockFetch(() => new Response(JSON.stringify({ errorCode: 'MOTH-NF-01' }), { status: 404 }));
  assert.equal((await worker.fetch(req('/mot/ZZ99ZZZ'), env)).status, 404);
  assert.equal((await worker.fetch(req('/mot/ZZ99ZZZ'), { DVLA_API_KEY: 'x' })).status, 503);
});

test('health says which services are set up', async () => {
  const r = await worker.fetch(req('/health'), { DVLA_API_KEY: 'x' });
  assert.deepEqual(await r.json(), { dvla: true, mot: false });
});

test('compactMot handles a brand-new car with no tests', () => {
  const c = compactMot({ registration: 'AB24CDE', make: 'FORD', model: 'PUMA', manufactureYear: '2024', motTestDueDate: '2027-03-01' });
  assert.equal(c.tests.length, 0);
  assert.equal(c.motTestDueDate, '2027-03-01');
  assert.equal(c.manufactureYear, '2024');
});
