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
