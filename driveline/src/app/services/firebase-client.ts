import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../environments/environment';

/**
 * Lazily loads Firebase only when it is needed (a form is sent, or /hub opens), so the
 * public pages do not pay for the SDK.
 *
 * Local testing against the Firebase emulators: open the site on localhost with
 * `?emulators=1` once (remembered for the browser session).
 */
let appPromise: Promise<FirebaseApp> | null = null;
let dbPromise: Promise<Firestore> | null = null;
let authPromise: Promise<Auth> | null = null;

export function firebaseConfigured(): boolean {
  return !!environment.firebase;
}

function useEmulators(): boolean {
  if (typeof window === 'undefined') return false;
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!local) return false;
  try {
    if (new URLSearchParams(window.location.search).get('emulators') === '1') {
      sessionStorage.setItem('dl.emulators', '1');
    }
    return sessionStorage.getItem('dl.emulators') === '1';
  } catch {
    return false;
  }
}

function app(): Promise<FirebaseApp> {
  if (!environment.firebase) return Promise.reject(new Error('Firebase is not configured'));
  appPromise ??= import('firebase/app').then(({ initializeApp, getApps }) =>
    getApps()[0] ?? initializeApp(environment.firebase!),
  );
  return appPromise;
}

export function firestore(): Promise<Firestore> {
  dbPromise ??= Promise.all([app(), import('firebase/firestore')]).then(([a, fs]) => {
    const db = fs.getFirestore(a);
    if (useEmulators()) fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    return db;
  });
  return dbPromise;
}

export function firebaseAuth(): Promise<Auth> {
  authPromise ??= Promise.all([app(), import('firebase/auth')]).then(([a, au]) => {
    const auth = au.getAuth(a);
    if (useEmulators()) au.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    return auth;
  });
  return authPromise;
}
