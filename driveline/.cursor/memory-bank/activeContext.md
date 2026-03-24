# DriveLine - Active Context

## Current State
**Status**: Feature-complete SPA + SSR; enquiries use **Web3Forms** when configured, else **mailto** fallback; stock is **refreshed from Fengate** via `npm run sync:stock`. DVLA lookup still dev-proxy only until production URL is set.

**Last Updated**: March 24, 2026

## Recent Work (Memory Bank Sync)

### Enquiries & validation
- **`submitEnquiryWithWeb3Fallback()`** (`src/app/utils/submit-enquiry.ts`) — browser-only; POST via **`Web3FormsEnquiryService`**; on `NOT_CONFIGURED` opens **`openSalesEnquiryEmail()`** (mailto).
- **`validateEnquiryFields()`** / **`validatePhoneField()`** (`src/app/utils/enquiry-validation.ts`) — required contact fields, email shape, **10–15 digits**, reject all-identical-digit “phones”; Contact page can **`requireMessage`**.
- **`scrollFormAlertIntoView()`** (`src/app/utils/scroll-form-alert.ts`) — after validation or API error, smooth-scroll to the alert (alerts sit **above the submit button** on Contact, Finance, Warranty, Vehicle detail).
- **Part exchange** final step uses the same validation + scroll IDs (`part-exchange-submit-alert`, step-1 uses `part-exchange-step1-alert`).
- Phone inputs: **`maxlength="22"`**, `inputmode="tel"`, `autocomplete="tel"`.

### Footer / header (QA)
- Footer **`salesMailtoHref`** uses **`SALES_EMAIL`** explicitly; **`BUSINESS_INFO.social`** drives Facebook / X / Instagram (`target="_blank"`, `rel="noopener noreferrer"`). Replace placeholder network URLs in **`reviews.data.ts`** with real profiles when known.
- Header **`header-is-scrolled`**: pill track background + stronger inactive/active nav contrast (`header.css`).

### Inventory
- **`npm run sync:stock`** → **`scripts/fetch-fengate-stock.mjs`** pulls live cars/vans from Fengate public API → writes **`src/app/data/vehicles.data.ts`**.

### Print (vehicle detail)
- Dedicated **`.vehicle-print-sheet`** (`hidden print:block`): dealer-style A4 layout — header/footer with borders, hero images, specs row, 3-col features (capped), description + **dynamic** QR/URL (`origin` + `<base href>` + `/vehicle/:id`, e.g. GitHub Pages).
- Main page chrome wrapped in **`print:hidden`**; **`main`** uses **`print:min-h-0`**; global print rules hide **`app-header` / `app-footer` / FAB** to avoid extra print pages.
- Print styles: `vehicle-detail.css` + `styles.css` print section.

### Contact / enquiries (constants)
- **`SALES_EMAIL`**: `src/app/constants/sales-contact.ts`.
- **`BUSINESS_INFO`** in `reviews.data.ts` — **`email: SALES_EMAIL`**, optional **`social`** block.
- **`openSalesEnquiryEmail()`** in `src/app/utils/enquiry-mailto.ts` — used only as **fallback** when Web3Forms access key is empty.

### Part exchange / DVLA
- **`DvlaVehicleService`** posts to **`environment.dvlaLookupUrl`** (dev: `/api/dvla-vehicle`).
- **`proxy.conf.cjs`**: proxies to DVLA Vehicle Enquiry API; **`DVLA_API_KEY`** env var (never in browser bundle).
- **`environment.prod.ts`**: `dvlaLookupUrl: ''` until a server-side proxy URL is set.
- Part exchange UI: loading/error states, green **DVLA summary card**, maps API fields into form (model still manual).

### Tech additions
- **`provideHttpClient(withFetch())`** in `app.config.ts`
- Environments + **production `fileReplacements`** in `angular.json`
- **`Vehicle.topSpeedMph?`** optional for print specs
- Vitest unit tests include **`enquiry-validation.spec.ts`**

## Known Issues / Ops
- **mailto** fallback does not send server-side; for reliable delivery, keep **Web3Forms** (or another API) configured in production.
- **DVLA lookup** disabled in prod build until `dvlaLookupUrl` points to a trusted proxy.
- EMFILE watcher warnings (non-fatal) may still appear locally.

## Development
- **URL**: http://localhost:4200
- **Command**: `cd driveline && npm start`
- **DVLA locally**: `export DVLA_API_KEY="..."` then `npm start` (see README)
- **Refresh stock**: `cd driveline && npm run sync:stock`

## Next Steps (optional)
- Serverless/backend proxy for DVLA in production + set `environment.prod.ts` URL
- Point **`BUSINESS_INFO.social`** at real dealer profiles
- SEO meta tags per page, analytics, a11y audit
