# Driveline

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### Vehicle stock (Fengate Car Sales)

Used cars and vans are **not** mocked: they are synced from **fengatecarsales.co.uk** using the same public API the dealer site uses (`/v1/vehicles/stock/{id}`). Images load from their CDN (`www.fengatecarsales.co.uk/photos/...`).

Refresh the local dataset after stock changes:

```bash
npm run sync:stock
```

This overwrites [`src/app/data/vehicles.data.ts`](src/app/data/vehicles.data.ts) (and derived `MAKES` / filter lists). Commit the updated file if you want the repo to match live stock at a point in time.

Vehicle detail pages use the full `images[]` from the feed (slideshow + thumbnails + hover cycle on listing cards), plus extra technical fields (dimensions, boot space, MPG urban/extra-urban, 0–60, road tax, seats) and a `sourceListingUrl` link to the matching advert on fengatecarsales.co.uk.

### UK registration lookup (DVLA API)

Part exchange / sell-your-car **Look up** uses the official [DVLA Vehicle Enquiry API](https://developer-portal.driver-vehicle-licensing.api.gov.uk/). Request an API key from the DVLA developer portal.

**Local development:** the app calls `/api/dvla-vehicle`, which is **proxied** by `proxy.conf.cjs` so your `x-api-key` is not bundled in the browser. Set the key in your environment before starting the dev server:

```bash
export DVLA_API_KEY="your-key-here"
npm start
```

Without `DVLA_API_KEY`, the proxy forwards requests without a key and DVLA will reject them.

**Production:** `environment.prod.ts` sets `dvlaLookupUrl` to `''` by default, so lookup is disabled until you point it at a **server-side proxy** you control (recommended), then set `dvlaLookupUrl` to that URL. Do not expose the DVLA key in client-side JavaScript.

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
