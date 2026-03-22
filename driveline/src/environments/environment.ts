/**
 * Development / local defaults (`ng serve`).
 * Production uses `environment.prod.ts` via `fileReplacements` in angular.json.
 */
export const environment = {
  production: false,
  /**
   * Proxied by `proxy.conf.cjs` → DVLA Vehicle Enquiry API.
   * Set `DVLA_API_KEY` in your shell when running `ng serve`.
   */
  dvlaLookupUrl: '/api/dvla-vehicle',
  /**
   * https://web3forms.com — free form emails (key is public in the browser bundle by design).
   */
  web3formsAccessKey: 'ac24cd39-47a7-4b3d-9b93-fccde8fec8ae',
};
