# DriveLine - Active Context

## Current State
**Status**: Feature-complete SPA + SSR; forms use client **mailto**; DVLA lookup via dev proxy; production needs DVLA backend for lookup.
**Last Updated**: March 21, 2026

## Recent Work (Memory Bank Sync)

### Print (vehicle detail)
- Dedicated **`.vehicle-print-sheet`** (`hidden print:block`): dealer-style A4 layout — header/footer with borders, hero images, specs row, 3-col features (capped), description + **dynamic** QR/URL (`origin` + `<base href>` + `/vehicle/:id`, e.g. GitHub Pages).
- Main page chrome wrapped in **`print:hidden`**; **`main`** uses **`print:min-h-0`**; global print rules hide **`app-header` / `app-footer` / FAB** to avoid extra print pages.
- Print styles: `vehicle-detail.css` + `styles.css` print section.

### Contact / enquiries
- **`SALES_EMAIL`**: `src/app/constants/sales-contact.ts` → **sales@drivelinecarsales.co.uk**
- **`BUSINESS_INFO.email`** in `reviews.data.ts` uses `SALES_EMAIL`.
- **`openSalesEnquiryEmail()`** in `src/app/utils/enquiry-mailto.ts` — Contact, Finance, Warranty, Vehicle detail enquiry, and Part exchange submit open mailto with pre-filled subject/body.

### Part exchange / DVLA
- **`DvlaVehicleService`** posts to **`environment.dvlaLookupUrl`** (dev: `/api/dvla-vehicle`).
- **`proxy.conf.cjs`**: proxies to DVLA Vehicle Enquiry API; **`DVLA_API_KEY`** env var (never in browser bundle).
- **`environment.prod.ts`**: `dvlaLookupUrl: ''` until a server-side proxy URL is set.
- Part exchange UI: loading/error states, green **DVLA summary card**, maps API fields into form (model still manual).

### Tech additions
- **`provideHttpClient(withFetch())`** in `app.config.ts`
- Environments + **production `fileReplacements`** in `angular.json`
- **`Vehicle.topSpeedMph?`** optional for print specs

## Known Issues / Ops
- **mailto** does not send server-side; production email delivery needs API/backend if required.
- **DVLA lookup** disabled in prod build until `dvlaLookupUrl` points to a trusted proxy.
- EMFILE watcher warnings (non-fatal) may still appear locally.

## Development
- **URL**: http://localhost:4200
- **Command**: `cd driveline && npm start`
- **DVLA locally**: `export DVLA_API_KEY="..."` then `npm start` (see README)

## Next Steps (optional)
- Serverless/backend proxy for DVLA in production + set `environment.prod.ts` URL
- Replace mailto with form API
- Real inventory API / images
