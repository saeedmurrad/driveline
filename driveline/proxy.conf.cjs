/**
 * Dev-only proxy: DVLA + DivineBytes platform API.
 */
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

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
const PLATFORM_API = `http://localhost:${process.env.PLATFORM_API_PORT || 4001}`;

module.exports = {
  '/api/public': {
    target: PLATFORM_API,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
  '/api/hub': {
    target: PLATFORM_API,
    secure: false,
    changeOrigin: true,
    logLevel: 'warn',
  },
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
