/**
 * DriveLine vehicle check worker (Cloudflare Workers, free plan).
 *
 * Lets the static website use the two free official UK vehicle APIs without ever
 * exposing a key in the browser:
 *
 *   POST /                 DVLA Vehicle Enquiry Service (body {"registrationNumber":"AB12CDE"})
 *                          → make, colour, fuel, engine size, year, tax and MOT status
 *   GET  /mot/{reg}        DVSA MOT History API
 *                          → make, model, colour, fuel, engine, recall status and every MOT
 *                            test (date, result, mileage, advisories, failures)
 *   GET  /health           which services are configured (no lookups made)
 *
 * Secrets (wrangler secret put NAME):
 *   DVLA_API_KEY                      DVLA VES key
 *   MOT_CLIENT_ID, MOT_CLIENT_SECRET  DVSA MOT History OAuth client
 *   MOT_TOKEN_URL                     token URL from the DVSA email
 *                                     (https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token)
 *   MOT_API_KEY                       DVSA X-API-Key
 * Optional: MOT_SCOPE (default https://tapi.dvsa.gov.uk/.default),
 *           ALLOWED_ORIGINS (comma list; default the DriveLine site + localhost).
 *
 * Only the DriveLine website may call it from a browser; other sites get 403.
 * MOT answers are cached for 12 hours to stay far inside DVSA limits.
 *
 * Spec: dvsa-mot-history-openapi.yml (copied from documentation.history.mot.api.gov.uk).
 */

export const DVLA_URL = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
export const MOT_BASE = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/';
const DEFAULT_SCOPE = 'https://tapi.dvsa.gov.uk/.default';
const DEFAULT_ORIGINS = [
  'https://drivelinecarsales.co.uk',
  'https://www.drivelinecarsales.co.uk',
];
const MOT_CACHE_SECONDS = 12 * 3600;

let motToken = null; // { value, expiresAt } — reused while this worker instance lives

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null; // not a browser (e.g. deploy check): allowed, no CORS header needed
  const list = (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',') : DEFAULT_ORIGINS).map((s) => s.trim());
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return list.includes(origin) || local ? origin : false;
}

function corsHeaders(origin) {
  const headers = { Vary: 'Origin' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(body, status, origin) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const err = (status, title, detail, origin) => json({ errors: [{ status: String(status), title, detail }] }, status, origin);

export function normaliseVrm(raw) {
  const vrm = String(raw || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return /^[A-Z0-9]{2,8}$/.test(vrm) ? vrm : null;
}

// ---------------- DVLA ----------------

async function dvla(request, env, origin) {
  if (!env.DVLA_API_KEY) return err(503, 'Service unavailable', 'DVLA lookup is not set up yet.', origin);
  let vrm;
  try {
    vrm = normaliseVrm((await request.json()).registrationNumber);
  } catch {
    vrm = null;
  }
  if (!vrm) return err(400, 'Bad request', 'Enter a valid UK registration.', origin);
  try {
    const r = await fetch(env.DVLA_URL || DVLA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'x-api-key': env.DVLA_API_KEY },
      body: JSON.stringify({ registrationNumber: vrm }),
    });
    return json(await r.text(), r.status, origin);
  } catch {
    return err(502, 'Bad gateway', 'Could not reach DVLA.', origin);
  }
}

// ---------------- DVSA MOT history ----------------

async function motAccessToken(env) {
  if (motToken && motToken.expiresAt > Date.now() + 60_000) return motToken.value;
  const r = await fetch(env.MOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.MOT_CLIENT_ID,
      client_secret: env.MOT_CLIENT_SECRET,
      scope: env.MOT_SCOPE || DEFAULT_SCOPE,
    }),
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  const t = await r.json();
  motToken = { value: t.access_token, expiresAt: Date.now() + (Number(t.expires_in) || 1200) * 1000 };
  return motToken.value;
}

const dateOnly = (s) => (typeof s === 'string' ? s.slice(0, 10) : null);
const mileage = (t) =>
  t.odometerResultType === 'READ' && t.odometerValue != null && /^\d+$/.test(String(t.odometerValue))
    ? { value: Number(t.odometerValue), unit: t.odometerUnit === 'KM' ? 'km' : 'mi' }
    : null;

/** Small, stable shape for the website (DVSA, DVA NI and CVS tests all fit). */
export function compactMot(v) {
  const tests = (Array.isArray(v.motTests) ? v.motTests : [])
    .map((t) => {
      const defects = Array.isArray(t.defects) ? t.defects : [];
      const of = (...types) => defects.filter((d) => types.includes(d.type) && d.text).map((d) => ({ text: d.text, dangerous: !!d.dangerous }));
      return {
        date: dateOnly(t.completedDate),
        result: t.testResult === 'PASSED' ? 'pass' : 'fail',
        expiry: dateOnly(t.expiryDate),
        mileage: mileage(t),
        advisories: of('ADVISORY'),
        minors: of('MINOR'),
        failures: of('FAIL', 'MAJOR', 'DANGEROUS', 'PRS'),
      };
    })
    .filter((t) => t.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    registration: v.registration ?? null,
    make: v.make ?? null,
    model: v.model ?? null,
    colour: v.primaryColour ?? null,
    fuelType: v.fuelType ?? null,
    engineSizeCc: v.engineSize != null && /^\d+$/.test(String(v.engineSize)) ? Number(v.engineSize) : null,
    firstUsedDate: v.firstUsedDate ?? null,
    manufactureYear: v.manufactureYear ?? (v.manufactureDate ? String(v.manufactureDate).slice(0, 4) : null),
    motTestDueDate: v.motTestDueDate ?? null,
    hasOutstandingRecall: v.hasOutstandingRecall ?? null,
    tests,
  };
}

async function mot(vrmRaw, env, origin, ctx) {
  if (!(env.MOT_CLIENT_ID && env.MOT_CLIENT_SECRET && env.MOT_TOKEN_URL && env.MOT_API_KEY)) {
    return err(503, 'Service unavailable', 'MOT history is not set up yet.', origin);
  }
  const vrm = normaliseVrm(vrmRaw);
  if (!vrm) return err(400, 'Bad request', 'Enter a valid UK registration.', origin);

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cacheKey = new Request(`https://cache.driveline.internal/mot/${vrm}`);
  const hit = cache && (await cache.match(cacheKey));
  if (hit) return json(await hit.text(), 200, origin);

  try {
    const call = async () =>
      fetch((env.MOT_BASE || MOT_BASE) + encodeURIComponent(vrm), {
        headers: { Authorization: `Bearer ${await motAccessToken(env)}`, 'X-API-Key': env.MOT_API_KEY, Accept: 'application/json' },
      });
    let r = await call();
    if (r.status === 401 || r.status === 403) {
      const body = await r.clone().text();
      if (/MOTH-FB-02|MOTH-UA-01/.test(body)) {
        motToken = null; // expired token: get a fresh one once
        r = await call();
      }
    }
    if (r.status === 404) return err(404, 'Not found', 'No MOT record for that registration.', origin);
    if (!r.ok) return err(r.status === 429 ? 429 : 502, 'Upstream error', `DVSA answered ${r.status}.`, origin);
    const body = JSON.stringify(compactMot(await r.json()));
    if (cache) {
      const put = cache.put(cacheKey, new Response(body, { headers: { 'Cache-Control': `max-age=${MOT_CACHE_SECONDS}` } }));
      ctx?.waitUntil ? ctx.waitUntil(put) : await put;
    }
    return json(body, 200, origin);
  } catch {
    return err(502, 'Bad gateway', 'Could not reach DVSA.', origin);
  }
}

export default {
  async fetch(request, env, ctx) {
    const origin = allowedOrigin(request, env);
    if (origin === false) return err(403, 'Forbidden', 'This service is only for drivelinecarsales.co.uk.', null);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'GET' && path === '/health') {
      return json(
        { dvla: !!env.DVLA_API_KEY, mot: !!(env.MOT_CLIENT_ID && env.MOT_CLIENT_SECRET && env.MOT_TOKEN_URL && env.MOT_API_KEY) },
        200,
        origin,
      );
    }
    if (request.method === 'GET' && path.startsWith('/mot/')) return mot(decodeURIComponent(path.slice(5)), env, origin, ctx);
    if (request.method === 'POST' && (path === '/' || path === '/vehicle')) return dvla(request, env, origin);
    return err(404, 'Not found', 'Use POST / or GET /mot/{registration}.', origin);
  },
};
