# DriveLine - System Patterns

## Component Architecture

### Layout Components
- `HeaderComponent` - Fixed navbar, mobile menu, dark mode toggle (`print:hidden` on host in `app.html` + global CSS backup)
- `FooterComponent` - Business info from **`BUSINESS_INFO`**, `mailto:` sales email
- `CookieBannerComponent` - GDPR consent

### Page Components
Standalone components: Home, Vehicles, VehicleDetail, Finance, Warranty, SellYourCar, Reviews, Contact, Legal.

### Shared: Part Exchange
- **`PartExchangeFormComponent`** — `variant: 'page' | 'modal'`, optional **`vehicleOfInterest`** (`Vehicle`) from stock page.
- Step 1: registration **Look up** → **`DvlaVehicleService.lookupByRegistration()`** → fills form + **`dvlaVehicleDetails` signal** for summary card.
- Submit → **`openSalesEnquiryEmail()`** with DVLA snapshot + form fields.

## State Management

### VehicleService (signals)
`allVehicles`, `filters`, `sortBy`, `filteredVehicles`, `featuredVehicles`, `getVehicleById`.

### Business / contact data
- **`BUSINESS_INFO`** exported from **`src/app/data/reviews.data.ts`** (includes **`email: SALES_EMAIL`**).
- **`SALES_EMAIL`** defined in **`src/app/constants/sales-contact.ts`**.

## Enquiry / forms pattern
- Not HTTP POST — **`openSalesEnquiryEmail(subject, body)`** builds **`mailto:sales@drivelinecarsales.co.uk?...`**
- Used by: Contact, Finance, Warranty, VehicleDetail `submitEnquiry`, PartExchange `submitForm`.
- SSR: only call mailto when `isPlatformBrowser`.

## Vehicle print pattern
- **`#vehicle-detail-page`** contains **`vehicle-print-sheet`** (`hidden print:block`) then **`print:hidden`** wrapper for normal UI.
- **`vehicle-detail.css`**: `@page` A4, bordered print bars, explicit text colours, compact heights.
- QR / print listing URL: **`getCanonicalVehicleListingUrl()`** uses **`origin` + `<base href>`** (e.g. GitHub Pages `…/driveline/vehicle/{id}`); **`getQrCodeImageUrl()`** encodes that (api.qrserver.com).

## Routing Pattern
Lazy `loadComponent` with optional `data: { vehicleType }` for cars/vans.

## SSR Safety Pattern
```typescript
private platformId = inject(PLATFORM_ID);
if (isPlatformBrowser(this.platformId)) { /* window, mailto, client-only */ }
```

## Styling Patterns
- Global: `.btn-primary`, `.form-input`, `.card`, `.hero-gradient`, etc. (`styles.css`)
- Tailwind theme: `primary`, `accent`, `dark`, fonts Inter/Poppins (`tailwind.config.js`)

## Data Models (selected)
- **`Vehicle`** — includes optional **`topSpeedMph`** for print spec row
- **`DvlaVehicleDetails`** — DVLA API response subset (`dvla-vehicle.model.ts`)
- **`BusinessInfo`** — dealership contact block

## Angular config
- **`app.config.ts`**: `provideHttpClient(withFetch())`, router, hydration
- **`angular.json`**: `serve.options.proxyConfig`: `proxy.conf.cjs`; production **`fileReplacements`** for environments
