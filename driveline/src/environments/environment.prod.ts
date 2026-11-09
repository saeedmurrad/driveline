import type { FirebaseWebConfig } from './firebase-config';
export const environment = {
  production: true,
  useStaticData: false,
  platformApiUrl: '/api',
  defaultDealerSlug: 'driveline',
  dvlaLookupUrl: '/api/dvla-vehicle',
  dvlaApiKey: '',
  web3formsAccessKey: '',
  /** Platform builds store enquiries through the platform API instead. */
  firebase: null as FirebaseWebConfig | null,
};
