# DVLA VES proxy (Cloudflare Worker)

GitHub Pages serves **static files only**. The browser cannot call `https://driver-vehicle-licensing.api.gov.uk/...` directly because **CORS** blocks it — you see *“Could not reach the registration service”* (HTTP status 0).

This worker forwards `POST` requests to DVLA and adds **CORS** headers so your Angular app can call the worker instead.

## Setup

1. Install [Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) and log in: `wrangler login`
2. From this folder: `wrangler deploy`
3. Copy the worker URL (e.g. `https://driveline-dvla-ves-proxy.your-account.workers.dev`)

### API key (choose one)

- **A)** Keep using `dvlaApiKey` in the app — the browser sends `x-api-key`; the worker forwards it to DVLA.  
- **B)** Store the key only on the worker: `wrangler secret put DVLA_API_KEY` — then you can leave `dvlaApiKey` empty in production (requires a small app change if you want to drop the header).

## GitHub Pages

In the GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Name | Value |
|------|--------|
| `DVLA_LOOKUP_URL` | **Full worker URL** e.g. `https://driveline-dvla-ves-proxy.youraccount.workers.dev` — **not** your DVLA `x-api-key` |

If you paste the API key into `DVLA_LOOKUP_URL`, the site will call `…/driveline/<key>` and you’ll get **405** errors.

The deploy workflow patches `environment.prod.ts` before build so `dvlaLookupUrl` points at the worker.

Redeploy the site after saving the secret.

### “Method not allowed” when opening the worker URL in a browser

That’s normal if you only **paste the URL in the address bar** — that sends **GET**. DVLA (and this proxy) expect **POST** with JSON `{"registrationNumber":"…"}` and `x-api-key`. Your **Angular app** does that automatically. A **GET** to the worker should return `200` with usage JSON (after you redeploy the latest `worker.js`).
