/**
 * Dev-only proxy: keeps your DVLA `x-api-key` off the browser bundle.
 *
 * Usage:
 *   Set `dvlaApiKey` in `src/environments/environment.ts` (sent as `x-api-key` on `/api/dvla-vehicle`), and/or
 *   put `DVLA_API_KEY=...` in repo-root `.env` (loaded below), and/or:
 *   export DVLA_API_KEY="your-key-from-dvla-developer-portal"
 *   npm start
 *
 * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html
 * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html
 */
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

/** Same idea as `server.ts`: `ng serve` does not load `.env` unless we do (avoids 403 from DVLA with no key). */
function loadRepoDotEnv() {
  try {
    const envPath = join(__dirname, '.env');
    if (!existsSync(envPath)) return;
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    /* ignore */
  }
}

loadRepoDotEnv();

const DVLA_API_KEY = process.env.DVLA_API_KEY || '';

module.exports = {
  '/api/dvla-vehicle': {
    target: 'https://driver-vehicle-licensing.api.gov.uk',
    secure: true,
    changeOrigin: true,
    pathRewrite: {
      '^/api/dvla-vehicle': '/vehicle-enquiry/v1/vehicles',
    },
    onProxyReq: (proxyReq, req) => {
      const fromClient = req.headers['x-api-key'];
      const forwarded =
        (typeof fromClient === 'string' && fromClient.trim()) ||
        (Array.isArray(fromClient) && fromClient[0]?.trim()) ||
        '';
      const apiKey = forwarded || DVLA_API_KEY;
      if (apiKey) {
        proxyReq.setHeader('x-api-key', apiKey);
      }
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Accept', 'application/json');
    },
    logLevel: 'warn',
  },
};
