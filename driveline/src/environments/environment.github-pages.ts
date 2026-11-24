import type { FirebaseWebConfig } from './firebase-config';
/** GitHub Pages — static DriveLine site, data baked into the app. */
export const environment = {
  production: true,
  useStaticData: true,
  platformApiUrl: '',
  defaultDealerSlug: 'driveline',
  dvlaLookupUrl: '',
  dvlaApiKey: '',
  web3formsAccessKey: '',
  /** Alerts (price drops, new arrivals, staff enquiry alerts): worker URL and its public signing key. Both are public. */
  pushApiUrl: 'https://driveline-dvla-ves-proxy.snatechltd.workers.dev',
  vapidPublicKey: 'BNS8gCZe7anSfg7EfnErXGuP4faEEE4Ga5g6ydDyszYYndMzVo_G-EGPfxqBPZWnR2FA5sRgwlntkTI8_PXGzCQ',
  /**
   * DriveLine's Firebase project (enquiries + /hub leads). Web config is public by
   * design; access is controlled by firestore.rules.
   */
  firebase: {
    apiKey: 'AIzaSyBG6NwNdjP9DhkY4wFXMbAo1HzxS2KHs94',
    authDomain: 'driveline-car-sales.firebaseapp.com',
    projectId: 'driveline-car-sales',
    storageBucket: 'driveline-car-sales.firebasestorage.app',
    messagingSenderId: '419788300851',
    appId: '1:419788300851:web:25e67c03a232f59b413946',
  } as FirebaseWebConfig | null,
};
