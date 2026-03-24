# DriveLine - Technical Context

## Tech Stack
- **Framework**: Angular 21 with SSR (Server-Side Rendering)
- **Styling**: Tailwind CSS v3.4.19
- **Build Tool**: Angular CLI with Vite (internal)
- **Package Manager**: npm
- **Node Version**: v25.8.1 (odd; LTS recommended for production)

## Key Dependencies
```json
{
  "@angular/core": "^21.x",
  "@angular/router": "^21.x",
  "@angular/ssr": "^21.x",
  "@angular/common/http": "HttpClient + withFetch()",
  "tailwindcss": "^3.4.19",
  "express": "for SSR server"
}
```

## Project Structure (high level)
```
driveline/
├── src/
│   ├── environments/
│   │   ├── environment.ts          # dev: dvlaLookupUrl proxy path
│   │   └── environment.prod.ts   # prod: dvlaLookupUrl '' until configured
│   ├── app/
│   │   ├── components/           # layout, search, vehicles, shared (part-exchange-form)
│   │   ├── pages/
│   │   ├── services/             # vehicle, dvla-vehicle, web3forms-enquiry, …
│   │   ├── models/               # vehicle, contact, dvla-vehicle, …
│   │   ├── data/                 # vehicles.data.ts (sync script), reviews + BUSINESS_INFO
│   │   ├── constants/            # sales-contact.ts (SALES_EMAIL)
│   │   └── utils/                # enquiry-mailto, submit-enquiry, enquiry-validation, scroll-form-alert
│   ├── styles.css
│   └── index.html
├── proxy.conf.cjs                # Dev: /api/dvla-vehicle → DVLA + x-api-key
├── scripts/
│   └── fetch-fengate-stock.mjs   # npm run sync:stock → vehicles.data.ts
├── tailwind.config.js
├── angular.json                  # fileReplacements (prod env), serve proxyConfig
└── package.json
```

## Development Commands
```bash
cd driveline
export DVLA_API_KEY="your-dvla-key"   # optional, for registration lookup
npm start          # http://localhost:4200 (uses proxy.conf.cjs)
npm run build      # Production build (swaps environment.prod.ts)
npm run sync:stock # Pull Fengate API → src/app/data/vehicles.data.ts
npm test           # Vitest (ng test --no-watch)
```

## Environments
- Import: `import { environment } from '../../environments/environment';`
- **Production build** replaces `environment.ts` with **`environment.prod.ts`** (`fileReplacements` in `angular.json`).

## HTTP / DVLA
- **`DvlaVehicleService`**: `POST` JSON `{ registrationNumber }` to `environment.dvlaLookupUrl`.
- **Dev**: URL `/api/dvla-vehicle` → **`proxy.conf.cjs`** → `https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles` with header **`x-api-key`** from **`process.env.DVLA_API_KEY`**.
- **Prod**: set `dvlaLookupUrl` to same-origin or backend URL that proxies DVLA (do not ship API key to browser).

## SSR Configuration
- Dynamic routes like `/vehicle/:id` use `RenderMode.Client` where configured
- Static routes prerendered at build time
- Legal pages use `getPrerenderParams` where applicable

## Important Patterns
- **Signals**: Reactive state in components + VehicleService
- **Lazy Loading**: Page routes lazy-loaded
- **View Transitions**: `withViewTransitions()` on router
- **Platform checks**: `isPlatformBrowser(PLATFORM_ID)` for `window`, mailto/Web3Forms submit, print, DVLA button
- **Enquiries**: `validateEnquiryFields` before `submitEnquiryWithWeb3Fallback`; form alerts above submit + optional scroll (`scroll-form-alert.ts`)
- **Print QR / listing URL**: resolved from browser `origin` + `<base href>` (`getDeployedAppBaseUrl` in vehicle detail) so GitHub Pages and any host work
