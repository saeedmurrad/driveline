/**
 * Production: point this at your own backend that proxies to DVLA (recommended),
 * or leave empty to disable registration lookup in the UI.
 */
export const environment = {
  production: true,
  dvlaLookupUrl: '',
  /**
   * Optional: override via GitHub secret `WEB3FORMS_ACCESS_KEY` before build (see deploy workflow).
   * If empty, forms fall back to mailto.
   */
  web3formsAccessKey: 'ac24cd39-47a7-4b3d-9b93-fccde8fec8ae',
};
