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
};
