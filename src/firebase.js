import { initializeApp } from 'firebase/app';
// Firestore Lite: one-off reads and writes only (no live listeners), which keeps the app much smaller.
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore/lite';

// The Firebase project comes from the .env files: .env has the shared fast-app-cs499 project,
// a fork puts its own in .env.local, and `npm run dev:local` uses the emulator in .env.emulator.
// The config only identifies the project; it is not a secret. Access is controlled by firestore.rules.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};
if (!firebaseConfig.projectId) throw new Error('VITE_FIREBASE_PROJECT_ID is not set (see .env)');

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// "host:port" of a Firestore emulator on this computer, set only by `npm run dev:local`.
const emulator = env.VITE_FIRESTORE_EMULATOR;
if (emulator) {
  const [host, port] = emulator.split(':');
  connectFirestoreEmulator(db, host, Number(port));
  document.title = `${document.title} (local)`;
}
