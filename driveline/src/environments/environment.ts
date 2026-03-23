/**
 * Development / local defaults (`ng serve`).
 * Production uses `environment.prod.ts` via `fileReplacements` in angular.json.
 */
export const environment = {
  production: false,
  /**
   * Proxied by `proxy.conf.cjs` → DVLA Vehicle Enquiry API.
   * @see https://developer-portal.driver-vehicle-licensing.api.gov.uk/availableapis.html
   */
  dvlaLookupUrl: '/api/dvla-vehicle',
  /**
   * DVLA Vehicle Enquiry API key — set here (same file as Web3Forms) or via `DVLA_API_KEY` for the dev proxy / SSR only.
   * Like `web3formsAccessKey`, a non-empty value is sent from the app as `x-api-key` on `/api/dvla-vehicle` and is visible in the browser bundle.
   */
  dvlaApiKey: 'eYWCJ4jiTm9mkOZKGQkIA7yw6j2LtMJRaKAXc7K5',
  /**
   * https://web3forms.com — free form emails (key is public in the browser bundle by design).
   */
  web3formsAccessKey: 'ac24cd39-47a7-4b3d-9b93-fccde8fec8ae',
};
