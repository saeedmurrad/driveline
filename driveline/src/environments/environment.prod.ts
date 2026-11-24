import type { FirebaseWebConfig } from './firebase-config';
export const environment = {
  production: true,
  useStaticData: false,
  platformApiUrl: '/api',
  defaultDealerSlug: 'driveline',
  dvlaLookupUrl: '/api/dvla-vehicle',
  dvlaApiKey: '',
  web3formsAccessKey: '',
  /** Alerts are only switched on for the static DriveLine site. */
  pushApiUrl: '',
  vapidPublicKey: '',
  /** Platform builds store enquiries through the platform API instead. */
  firebase: null as FirebaseWebConfig | null,
};
