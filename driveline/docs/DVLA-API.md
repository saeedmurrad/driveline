# DVLA APIs (DriveLine integration)

DriveLine uses the **Vehicle Enquiry Service** so customers can look up a UK registration on **Sell your car** / **Part exchange** forms. You can set **`dvlaApiKey`** next to **`web3formsAccessKey`** in `environment.ts` / `environment.prod.ts` (sent as `x-api-key` on `/api/dvla-vehicle`; visible in the bundle like Web3Forms), or keep `dvlaApiKey` empty and use **`DVLA_API_KEY`** in `.env` / the host only.

## Official documentation

- **All available APIs (portal home list):**  
  [DVLA API Developer Portal — Current Available APIs](https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html)
- **Vehicle Enquiry Service (what we call):**
  - [Description](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html)
  - OpenAPI **JSON:**  
    `https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/v1.2.0-vehicle-enquiry-service.json`
- **Production base URL:**  
  `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles`  
  Method: `POST`, header: `x-api-key`, body: `{ "registrationNumber": "AB12CDE" }`

## How DriveLine wires it

| Environment | Mechanism |
|-------------|-----------|
| `ng serve` | [`proxy.conf.cjs`](../proxy.conf.cjs) forwards `/api/dvla-vehicle` → DVLA; `x-api-key` from the incoming request (`dvlaApiKey`) or `DVLA_API_KEY` (also loads repo **`.env`** at proxy startup). |
| `serve:ssr:driveline` (Node) | [`server.ts`](../src/server.ts) handles `POST /api/dvla-vehicle` the same way: request `x-api-key` or `process.env.DVLA_API_KEY`. |
| Static GitHub Pages | No Node proxy — set `dvlaLookupUrl` to `''` in `environment.prod.ts` (default). Lookup is disabled unless you add your own backend URL. |

## API key

Request access via the [developer portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/). Prefer **`dvlaApiKey`** in environments (same place as Web3Forms) or **`.env`** / host-only `DVLA_API_KEY`; never commit real keys to the repo.

If a key is ever exposed (e.g. in chat or a public repo), **revoke it in the DVLA portal and create a new one.**

## Why sites like Fengate Car Sales show model, derivative, gearbox, owners (but VES does not)

**Official VES response** (OpenAPI schema `Vehicle`) includes things like `registrationNumber`, `make`, `colour`, `fuelType`, `engineCapacity`, tax/MOT fields, `euroStatus`, `typeApproval`, `wheelplan`, etc. It does **not** include:

- Marketing **model** name (e.g. “C4 Picasso”)
- Full **derivative** / trim string
- **Gearbox** (manual/automatic)
- **Keeper / owner count**
- **Mileage**

So **no other DVLA “vehicle spec” API** in the [public portal list](https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html) fills that gap for a normal dealer workflow. Other products are different purposes (e.g. **KADOE** is keeper-at-event and heavily restricted; **Driver View** is licence data — not a VRM → full spec lookup).

**What Fengate (and many UK dealers) actually do:** their site is built on a **dealer platform** (their bundled `main.js` calls a same-origin **`/vrm`** lookup and their stock objects reference **CAP** / **iVendi**-style IDs). That **VRM service** merges:

1. Registration/tax/MOT style data (may use DVLA or aligned sources on the **supplier’s** side), with  
2. **Commercial automotive data** (e.g. **CAP** / **HPI** / similar) to resolve a VRM to **model, derivative, transmission, body**, and sometimes **keeper history** — under **their** supplier contract, not something you can reproduce with only the free DVLA VES key you use in DriveLine.

**If DriveLine needs Fengate-level detail (except mileage):** you would add a **paid** integration (CAP, HPI, Experian, or your platform’s VRM API if you move to one), plus pass their compliance/onboarding — it is **not** available by “switching to another DVLA API” alone.

## Terms

Use of DVLA data is subject to the portal terms and your registration with DVLA. This project does not substitute for legal/compliance review.
