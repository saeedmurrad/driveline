import type { FirebaseWebConfig } from './firebase-config';
/**
 * Development / local defaults (`ng serve`).
 */
export const environment = {
  production: false,
  useStaticData: false,
  /** Proxied to platform API (see proxy.conf.cjs) */
  platformApiUrl: '/api',
  /** Default tenant when host is localhost */
  defaultDealerSlug: 'demo',
  /** Server-side DVLA proxy path (SSR / dev proxy) */
  dvlaLookupUrl: '/api/dvla-vehicle',
  /** Keys are server-only in production; empty in browser builds when using platform API */
  dvlaApiKey: '',
  web3formsAccessKey: '',
  /** Platform builds store enquiries through the platform API instead. */
  firebase: null as FirebaseWebConfig | null,
};
