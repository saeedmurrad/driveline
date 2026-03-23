/**
 * Production browser build:
 * - **Static hosting (GitHub Pages, etc.):** use the official VES URL below so lookup is configured.
 *   The browser sends `x-api-key` from `dvlaApiKey`. If you see CORS / network errors, host **SSR** instead
 *   and set `dvlaLookupUrl` to `'/api/dvla-vehicle'` (see `docs/DVLA-API.md`).
 * - **Node SSR:** prefer `dvlaLookupUrl: '/api/dvla-vehicle'` so the key stays on the server (`DVLA_API_KEY` in `.env`).
 */
export const environment = {
  production: true,
  dvlaLookupUrl:
    'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
  /**
   * Same idea as `web3formsAccessKey`: optional DVLA key in this file for static/SSR builds.
   * Prefer leaving empty for public GitHub Pages; use a backend + env var for a non-exposed key.
   */
  dvlaApiKey: 'eYWCJ4jiTm9mkOZKGQkIA7yw6j2LtMJRaKAXc7K5',
  /**
   * Optional: override via GitHub secret `WEB3FORMS_ACCESS_KEY` before build (see deploy workflow).
   * If empty, forms fall back to mailto.
   */
  web3formsAccessKey: 'ac24cd39-47a7-4b3d-9b93-fccde8fec8ae',
};
