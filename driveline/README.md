# Driveline

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.2.

## Tests

```bash
npm test -- --watch=false
```

- **`DvlaVehicleService`** — validation, VRN normalisation, `x-api-key` header, DVLA error body mapping, HTTP edge cases (`src/app/services/dvla-vehicle.service.spec.ts`).
- **Part-exchange form** — lookup wiring, form mapping (make/colour/fuel/MOT), SSR guard (`src/app/components/shared/part-exchange-form/part-exchange-form.spec.ts`).

**Live DVLA check (optional):** with a real key, call VES directly (does not use the Angular app):

```bash
export DVLA_API_KEY="your-key"
npm run test:dvla-live -- YOURREG
# or: DVLA_TEST_VRN=YOURREG npm run test:dvla-live
```

If `DVLA_API_KEY` is unset, the script exits **0** (skipped) so CI stays green.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### UI & motion

- **Typography:** Plus Jakarta Sans (body) + Poppins (headings), loaded in `src/index.html`.
- **Tokens & motion:** CSS variables and animations in `src/styles.css`; `prefers-reduced-motion` disables hero drift, scroll reveals, and skeleton shimmer.
- **Scroll reveal:** Add `appReveal` to a section host (see `src/app/pages/home/home.html`); directive: `src/app/directives/reveal-on-scroll.directive.ts`.
- **Hero imagery:** Eight JPEGs in [`public/hero/`](public/hero/) (BMW X5/X7/7 Series/5 Series, Volvo XC90, Audi SQ7/A6, Citroen C5 Aircross) crossfading behind a **Fengate-style** white search band at the bottom of the hero. Images are sourced from Wikimedia Commons (CC licenses). Listing photos are not used in the hero.

### Vehicle stock (Fengate Car Sales)

Used cars and vans are **not** mocked: they are synced from **fengatecarsales.co.uk** using the same public API the dealer site uses (`/v1/vehicles/stock/{id}`). Images load from their CDN (`www.fengatecarsales.co.uk/photos/...`).

Refresh the local dataset after stock changes:

```bash
npm run sync:stock
```

This overwrites [`src/app/data/vehicles.data.ts`](src/app/data/vehicles.data.ts) (and derived `MAKES` / filter lists). Commit the updated file if you want the repo to match live stock at a point in time.

Vehicle detail pages use the full `images[]` from the feed (slideshow + thumbnails + hover cycle on listing cards), plus extra technical fields (dimensions, boot space, MPG urban/extra-urban, 0–60, road tax, seats) and a `sourceListingUrl` link to the matching advert on fengatecarsales.co.uk.

**Listing finance figures:** Cards and list views show **cash price** plus an illustrative **“from” monthly** payment (**60 months**, **0% deposit**, **9.9% APR** representative — lowest of the three **illustrative** terms). The vehicle **Finance** tab shows a **calculator for 36, 48 and 60 months** on the same basis. Logic lives in `src/app/utils/finance-display.ts`; `npm run sync:stock` writes `monthlyPrice` in `vehicles.data.ts` using the **60‑month** figure for consistency. Copy states figures are **illustrative** and **subject to status** — change APR/terms there and in `scripts/fetch-fengate-stock.mjs` if your lender rules differ.

### UK registration lookup (DVLA API)

Part exchange / sell-your-car **Look up** uses the **[Vehicle Enquiry Service](https://developer-portal.driver-vehicle-licensing.api.gov.uk/apis/vehicle-enquiry-service/vehicle-enquiry-service-description.html)** from the [DVLA API Developer Portal](https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html). See **[docs/DVLA-API.md](docs/DVLA-API.md)** for links to the OpenAPI spec and how the app calls the API.

**Where to put the key (same file as Web3Forms):** set **`dvlaApiKey`** next to **`web3formsAccessKey`** in [`src/environments/environment.ts`](src/environments/environment.ts) (local) and [`environment.prod.ts`](src/environments/environment.prod.ts) when needed. **`ng serve`** sends `x-api-key` to `/api/dvla-vehicle` (proxy). **Production static** builds post straight to the official VES URL with `x-api-key` from `dvlaApiKey`. **SSR** can use `/api/dvla-vehicle` + `DVLA_API_KEY` on the server instead. **Note:** like Web3Forms, a non-empty `dvlaApiKey` is visible in the browser bundle. Rotate the key in the DVLA portal if it is ever leaked.

**Optional `.env` fallback:** copy [`.env.example`](.env.example) to `.env` and set `DVLA_API_KEY` if you prefer not to use `dvlaApiKey` in environments. The proxy / SSR use the request’s `x-api-key` first, then `DVLA_API_KEY`.

**If the UI shows `403 Forbidden` on `/api/dvla-vehicle`:** DVLA is rejecting the call — almost always **no `x-api-key` was sent** (empty `dvlaApiKey` and no `DVLA_API_KEY`). Fix by setting one of those, **restart `ng serve`** after changing `.env`.

**Local development (`ng serve`):** the app posts to `/api/dvla-vehicle`; [`proxy.conf.cjs`](proxy.conf.cjs) forwards to DVLA using `x-api-key` from the request (`dvlaApiKey`) and/or `DVLA_API_KEY`. The proxy **loads repo-root `.env` automatically** (you do not need `export` unless you prefer the shell):

```bash
cp .env.example .env
# edit .env → DVLA_API_KEY=your-key-from-dvla-portal
npm start
```

**Production / SSR (`ng build` + `npm run serve:ssr:driveline`):** [`src/server.ts`](src/server.ts) handles `POST /api/dvla-vehicle` the same way and loads `.env` from the **project root**. Set `dvlaLookupUrl: '/api/dvla-vehicle'` in [`environment.prod.ts`](src/environments/environment.prod.ts) when serving from Node.

**Static GitHub Pages:** Browsers **block** direct requests to DVLA (**CORS**), so you’ll see *“Could not reach the registration service”* unless you use a proxy.

1. Deploy the **[Cloudflare Worker](workers/dvla-ves-proxy/README.md)** (`wrangler deploy` in `workers/dvla-ves-proxy/`).
2. In the repo → **Settings → Secrets → Actions**, add **`DVLA_LOOKUP_URL`** = your worker URL (no trailing slash).
3. Push / rerun **Deploy to GitHub Pages** — CI patches `dvlaLookupUrl` before build.

Without the secret, the app still targets the official DVLA URL and lookup fails in the browser. **SSR** with `dvlaLookupUrl: '/api/dvla-vehicle'` also works — see [docs/DVLA-API.md](docs/DVLA-API.md).

### Enquiry forms (Web3Forms — free email)

Contact, finance, warranty, vehicle enquiries, and part-exchange use **[Web3Forms](https://web3forms.com)** so submissions are emailed without opening the user’s mail app.

1. Create a form at Web3Forms and set the **recipient email** (in their dashboard) to the inbox you want.
2. Copy the **access key**.
3. **Local:** set `web3formsAccessKey` in [`src/environments/environment.ts`](src/environments/environment.ts).
4. **GitHub Pages CI:** add a repository secret **`WEB3FORMS_ACCESS_KEY`** with that key. The deploy workflow injects it into `environment.prod.ts` before build.

If `web3formsAccessKey` is empty, the app falls back to `mailto:` for the same enquiry.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

### GitHub Pages

From the **repository root** (parent of `driveline/`), CI builds with:

`npm run build:gh-pages` → base href `/driveline/` for `https://<user>.github.io/driveline/`.

Enable **Pages → Source: GitHub Actions** in repo settings. See the root [README](../README.md#github-pages).

**Favicon & link previews:** [`public/favicon.svg`](public/favicon.svg) matches the header car mark. Open Graph / Twitter image is [`public/og-image.svg`](public/og-image.svg); absolute URLs in [`src/index.html`](src/index.html) point at `https://saeedmurrad.github.io/driveline/`. If you use a **custom domain**, update `og:url`, `og:image`, and `twitter:image` there. Facebook/LinkedIn sometimes prefer **PNG** (1200×630) for `og:image` — export `og-image.svg` and switch the meta URLs to `og-image.png` if previews fail.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
