/**
 * Checks firestore.rules against the local Firebase emulators (never the real project).
 *
 *   npm run test:rules
 *   (= firebase emulators:exec --only auth,firestore "node scripts/test-firestore-rules.mjs")
 *
 * Creates throwaway users in the Auth emulator and data in the Firestore emulator only.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc, arrayUnion, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs,
  getFirestore, serverTimestamp, setDoc, updateDoc,
} from 'firebase/firestore';

const PROJECT = process.env.GCLOUD_PROJECT || 'driveline-car-sales';
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const FS = process.env.FIRESTORE_EMULATOR_HOST;
if (!AUTH || !FS) {
  console.error('Run through the emulators: npm run test:rules');
  process.exit(1);
}

const app = initializeApp({ projectId: PROJECT, apiKey: 'emulator' });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://${AUTH}`, { disableWarnings: true });
const db = getFirestore(app);
const [fsHost, fsPort] = FS.split(':');
connectFirestoreEmulator(db, fsHost, Number(fsPort));

/** Emulator-only helpers (owner access bypasses rules). */
async function emulatorUser(email) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'test-only-pw', returnSecureToken: true }),
  });
  return (await r.json()).localId;
}
async function asOwnerSetStaff(uid) {
  const url = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/staff/${uid}`;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: { role: { stringValue: 'admin' } } }),
  });
}

let failed = 0;
async function expect(label, shouldAllow, fn) {
  let allowed = true;
  try {
    await fn();
  } catch (e) {
    allowed = false;
    if (!String(e?.code ?? e).includes('permission-denied')) console.log(`    (${e?.code ?? e})`);
  }
  const ok = allowed === shouldAllow;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} → ${allowed ? 'allowed' : 'denied'}`);
}

const lead = {
  type: 'test-drive', subject: 'Test drive: 2019 Audi A6', name: 'Test Buyer', email: 'buyer@example.test',
  phone: '07700 900123', message: 'Saturday morning please', page: '/vehicle/10475',
  vehicleId: '10475', vehicleLabel: '2019 Audi A6 Avant', status: 'new', notes: [], createdAt: serverTimestamp(),
};

const staffUid = await emulatorUser('staff@example.test');
await emulatorUser('stranger@example.test');
await asOwnerSetStaff(staffUid);

// Public visitor
let leadId;
await expect('visitor sends a valid enquiry', true, async () => {
  leadId = (await addDoc(collection(db, 'leads'), lead)).id;
});
await expect('visitor sends one without phone or email', false, () => addDoc(collection(db, 'leads'), { ...lead, email: '', phone: '' }));
await expect('visitor pre-sets status to won', false, () => addDoc(collection(db, 'leads'), { ...lead, status: 'won' }));
await expect('visitor adds an unknown field', false, () => addDoc(collection(db, 'leads'), { ...lead, admin: true }));
await expect('visitor sends a 6000-character message', false, () => addDoc(collection(db, 'leads'), { ...lead, message: 'x'.repeat(6000) }));
await expect('visitor fakes the time', false, () => addDoc(collection(db, 'leads'), { ...lead, createdAt: new Date(2020, 0, 1) }));
await expect('visitor reads leads', false, () => getDocs(collection(db, 'leads')));
await expect('visitor reads one lead', false, () => getDoc(doc(db, 'leads', leadId)));
await expect('visitor deletes a lead', false, () => deleteDoc(doc(db, 'leads', leadId)));
await expect('visitor makes themself staff', false, () => setDoc(doc(db, 'staff', 'x'), { role: 'admin' }));

// Signed in, not staff
await signInWithEmailAndPassword(auth, 'stranger@example.test', 'test-only-pw');
await expect('non-staff reads leads', false, () => getDocs(collection(db, 'leads')));
await expect('non-staff changes status', false, () =>
  updateDoc(doc(db, 'leads', leadId), { status: 'lost', updatedAt: serverTimestamp(), updatedBy: 'stranger@example.test' }));
await expect('non-staff adds themself to staff', false, () => setDoc(doc(db, 'staff', auth.currentUser.uid), { role: 'admin' }));
await signOut(auth);

// Staff
await signInWithEmailAndPassword(auth, 'staff@example.test', 'test-only-pw');
await expect('staff reads own staff entry', true, () => getDoc(doc(db, 'staff', staffUid)));
await expect('staff lists leads', true, () => getDocs(collection(db, 'leads')));
await expect('staff sets status to contacted', true, () =>
  updateDoc(doc(db, 'leads', leadId), { status: 'contacted', updatedAt: serverTimestamp(), updatedBy: 'staff@example.test' }));
await expect('staff adds a note', true, () =>
  updateDoc(doc(db, 'leads', leadId), {
    notes: arrayUnion({ at: new Date().toISOString(), by: 'staff@example.test', text: 'Called, booked Sat 10am' }),
    updatedAt: serverTimestamp(), updatedBy: 'staff@example.test',
  }));
await expect('staff sets an unknown status', false, () =>
  updateDoc(doc(db, 'leads', leadId), { status: 'maybe', updatedAt: serverTimestamp(), updatedBy: 'staff@example.test' }));
await expect('staff edits what the customer sent', false, () =>
  updateDoc(doc(db, 'leads', leadId), { message: 'changed', updatedAt: serverTimestamp(), updatedBy: 'staff@example.test' }));
await expect('staff signs a change as someone else', false, () =>
  updateDoc(doc(db, 'leads', leadId), { status: 'won', updatedAt: serverTimestamp(), updatedBy: 'boss@example.test' }));
await expect('staff deletes a lead', false, () => deleteDoc(doc(db, 'leads', leadId)));
await signOut(auth);

// Visit counter (same REST call the website makes)
const commit = (fieldTransforms, day = '2026-11-10') =>
  fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ transform: { document: `projects/${PROJECT}/databases/(default)/documents/stats/${day}`, fieldTransforms } }] }),
  }).then(async (r) => { if (!r.ok) throw Object.assign(new Error(await r.text()), { code: r.status === 403 ? 'permission-denied' : r.status }); });
const inc = (fieldPath, n = 1) => ({ fieldPath, increment: { integerValue: String(n) } });
await expect('visitor counts a first page view (new day)', true, () =>
  commit([inc('views'), inc('visits'), inc('pages.`home`'), inc('sources.`google`'), inc('devices.`mobile`')]));
await expect('visitor counts a car page view', true, () => commit([inc('views'), inc('pages.`vehicle`'), inc('cars.`10475`')]));
await expect('visitor adds 1000 views at once', false, () => commit([inc('views', 1000)]));
await expect('visitor bumps two pages in one go', false, () => commit([inc('views'), inc('pages.`home`'), inc('pages.`cars`')]));
await expect('visitor lowers the count', false, () => commit([inc('views', -1)]));
await expect('visitor writes a made-up day id', false, () => commit([inc('views')], 'hello'));
await expect('visitor reads the stats', false, () => getDoc(doc(db, 'stats', '2026-11-10')));
await expect('visitor deletes the stats', false, () => deleteDoc(doc(db, 'stats', '2026-11-10')));
await signInWithEmailAndPassword(auth, 'staff@example.test', 'test-only-pw');
await expect('staff reads the stats', true, async () => {
  const snap = await getDoc(doc(db, 'stats', '2026-11-10'));
  const d = snap.data();
  if (d.views !== 2 || d.visits !== 1 || d.cars['10475'] !== 1) throw new Error('unexpected counts ' + JSON.stringify(d));
});
await signOut(auth);

await deleteApp(app);
console.log(failed ? `\n${failed} rule check(s) failed.` : '\nAll rule checks passed.');
process.exit(failed ? 1 : 0);
