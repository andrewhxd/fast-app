import { initializeApp } from 'firebase/app';
// Firestore Lite: one-off reads and writes only (no live listeners), which keeps the app much smaller.
import { getFirestore } from 'firebase/firestore/lite';

// Web app "FASTapp" in the fast-app-cs499 Firebase project.
// This config only identifies the project; it is not a secret. Access is controlled by firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBjJDNpg_5A1v_G6i5uf1oGhp9q6BfuxAM',
  authDomain: 'fast-app-cs499.firebaseapp.com',
  projectId: 'fast-app-cs499',
  storageBucket: 'fast-app-cs499.firebasestorage.app',
  messagingSenderId: '29969942884',
  appId: '1:29969942884:web:a712d06f29667393179271',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
