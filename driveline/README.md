# Driveline

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

### UK registration lookup (DVLA API)

Part exchange / sell-your-car **Look up** uses the official [DVLA Vehicle Enquiry API](https://developer-portal.driver-vehicle-licensing.api.gov.uk/). Request an API key from the DVLA developer portal.

**Local development:** the app calls `/api/dvla-vehicle`, which is **proxied** by `proxy.conf.cjs` so your `x-api-key` is not bundled in the browser. Set the key in your environment before starting the dev server:

```bash
export DVLA_API_KEY="your-key-here"
npm start
```

Without `DVLA_API_KEY`, the proxy forwards requests without a key and DVLA will reject them.

**Production:** `environment.prod.ts` sets `dvlaLookupUrl` to `''` by default, so lookup is disabled until you point it at a **server-side proxy** you control (recommended), then set `dvlaLookupUrl` to that URL. Do not expose the DVLA key in client-side JavaScript.

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
