# DriveLine vehicle check worker (Cloudflare Workers, free)

One small worker lets the static website use the two **free official** UK vehicle APIs
without ever putting a key in the browser:

| Route | Upstream | Gives |
|---|---|---|
| `POST /` body `{"registrationNumber":"AB12CDE"}` | DVLA Vehicle Enquiry Service | make, colour, fuel, engine, year, tax + MOT status |
| `GET /mot/AB12CDE` | DVSA MOT History API | make, **model**, colour, fuel, engine, recall status, every MOT test with mileage, advisories and failures |
| `GET /health` | – | which of the two are set up |

Only drivelinecarsales.co.uk (and localhost) may call it from a browser. MOT answers are
cached for 12 hours. The website switches each feature on by itself:
**Sell Your Car → Look up** and the **MOT history** tab on every car page.

Live worker: `https://driveline-dvla-ves-proxy.snatechltd.workers.dev` on the SNA Tech
Cloudflare account (snatechltd@gmail.com), stored in the GitHub secret `DVLA_LOOKUP_URL`
since 11 Nov 2026. (An older copy of the first version still runs on another Cloudflare
account at `driveline-dvla-ves-proxy.driveline-dvla-ves-proxy.workers.dev`; nothing uses it.)

## 1. Get the free keys (Saeed, once)

**Applied 11 Nov 2026** by SNATECH LTD (contact info@snatech.co.uk): DVLA VES application
submitted; DVSA MOT History form reference **AW3LC5AD**. Keys arrive by email.

- **DVLA VES key**: https://register-for-ves.driver-vehicle-licensing.api.gov.uk
- **DVSA MOT History**: https://documentation.history.mot.api.gov.uk/mot-history-api/register
  (review takes up to 5 working days; the email contains client ID, client secret,
  token URL and API key). The key is revoked after 90 days without use, which the live
  site prevents.

## 2. Put them on the worker

```bash
cd driveline/workers/dvla-ves-proxy
wrangler login                      # opens Cloudflare in the browser
wrangler secret put DVLA_API_KEY
wrangler secret put MOT_CLIENT_ID
wrangler secret put MOT_CLIENT_SECRET
wrangler secret put MOT_TOKEN_URL   # https://login.microsoftonline.com/<tenant>/oauth2/v2.0/token
wrangler secret put MOT_API_KEY
wrangler deploy
```

## 3. Redeploy the site

Push to `main` (or re-run the Pages workflow). The deploy asks the worker's `/health`
and only switches the features on when it answers; until then the Look up button and
MOT tab stay hidden, so customers never see a broken button.

## Tests

- `node --test workers/dvla-ves-proxy/worker.test.mjs`: worker logic with mocked APIs.
- `node scripts/mock-vehicle-apis.mjs` runs this worker locally with stand-in DVLA/DVSA
  servers; `scripts/e2e-vehicle-check.mjs` then tests the website features in Chrome.

`dvsa-mot-history-openapi.yml` is the official DVSA spec (Open Government Licence v3.0).
