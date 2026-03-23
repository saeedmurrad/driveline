/**
 * Production browser build:
 * - **Static hosting (e.g. GitHub Pages):** keep `dvlaLookupUrl` empty — there is no `/api` on that host.
 * - **Node SSR** (`ng build` + `serve:ssr:driveline`): set to `'/api/dvla-vehicle'` and set `dvlaApiKey` below
 *   and/or `DVLA_API_KEY` in `.env` (see `docs/DVLA-API.md`).
 */
export const environment = {
  production: true,
  dvlaLookupUrl: '',
  /**
   * Same idea as `web3formsAccessKey`: optional DVLA key in this file for static/SSR builds.
   * Prefer leaving empty for public GitHub Pages; use a backend + env var for a non-exposed key.
   */
  dvlaApiKey: '',
  /**
   * Optional: override via GitHub secret `WEB3FORMS_ACCESS_KEY` before build (see deploy workflow).
   * If empty, forms fall back to mailto.
   */
  web3formsAccessKey: 'ac24cd39-47a7-4b3d-9b93-fccde8fec8ae',
};
