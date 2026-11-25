/**
 * Runs the Cloudflare worker's code under Node for local alert testing (no Cloudflare needed).
 * Keeps sign-ups in memory. Reads the same secrets file wrangler would: workers/dvla-ves-proxy/.dev.vars
 *
 *   node scripts/local-push-worker.mjs            # http://127.0.0.1:8799
 *   GET /__kv  lists what is stored (local testing only)
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../workers/dvla-ves-proxy/worker.js';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../workers/dvla-ves-proxy');
const PORT = Number(process.env.PORT || 8799);
const vars = {};
for (const line of readFileSync(join(DIR, '.dev.vars'), 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at < 1 || line.startsWith('#')) continue;
  const raw = line.slice(at + 1).trim();
  vars[line.slice(0, at).trim()] = raw.startsWith('"') ? JSON.parse(raw) : raw;
}
const toml = readFileSync(join(DIR, 'wrangler.toml'), 'utf8');
for (const m of toml.matchAll(/^([A-Z_]+)\s*=\s*"([^"]*)"/gm)) vars[m[1]] ??= m[2];

// GONE_ONCE=1: the first notification is answered "410 gone", to test that the site renews its sign-up.
if (process.env.GONE_ONCE === '1') {
  const real = globalThis.fetch;
  let used = false;
  globalThis.fetch = (url, init) => {
    if (!used && /fcm\.googleapis\.com|push\.apple\.com|mozilla\.com/.test(String(url))) {
      used = true;
      return Promise.resolve(new Response('push subscription has unsubscribed or expired.', { status: 410 }));
    }
    return real(url, init);
  };
}

const store = new Map();
const env = {
  ...vars,
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(FIRESTORE_BASE|ALLOW_LOCAL_PUSH)$/.test(k))),
  PUSH_KV: {
    get: async (k, type) => (store.has(k) ? (type === 'json' ? JSON.parse(store.get(k)) : store.get(k)) : null),
    put: async (k, v) => void store.set(k, v),
    delete: async (k) => void store.delete(k),
    list: async ({ prefix, limit = 1000, cursor }) => {
      const all = [...store.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? Number(cursor) : 0;
      const complete = from + limit >= all.length;
      return { keys: all.slice(from, from + limit).map((name) => ({ name })), list_complete: complete, cursor: complete ? undefined : String(from + limit) };
    },
  },
};

createServer(async (req, res) => {
  if (req.url === '/__kv') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(Object.fromEntries([...store].map(([k, v]) => [k, k.startsWith('meta:') ? v : { ...JSON.parse(v), sub: '(hidden)' }]))));
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(`http://127.0.0.1:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
  });
  const r = await worker.fetch(request, env, { waitUntil() {} });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(PORT, '127.0.0.1', () => console.log(`local worker on http://127.0.0.1:${PORT}`));
