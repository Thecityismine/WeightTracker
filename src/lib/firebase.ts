import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// These are public by design — they ship in the browser bundle on every
// Firebase web app. Security comes from the UID-pinned rules, not secrecy.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Everything below initializes lazily, on first access.
//
// Next prerenders client components on the server at build time, so anything
// running at module scope runs during `next build` too — where these env vars
// may be absent and Firebase has no business connecting to anything. Deferring
// means the SDK only ever wakes up in a browser, when something actually asks.

let appRef: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;
let storageRef: FirebaseStorage | null = null;

function firebaseApp(): FirebaseApp {
  if (appRef) return appRef;

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      "Firebase client config is missing. Set the NEXT_PUBLIC_FIREBASE_* " +
        "variables locally in .env.local and in the Vercel project settings.",
    );
  }

  appRef = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return appRef;
}

export function getFirebaseAuth(): Auth {
  if (authRef) return authRef;

  authRef = getAuth(firebaseApp());

  // Stay signed in across app restarts. Logging in should be a rare event,
  // not a daily toll on the way to breakfast.
  void setPersistence(authRef, browserLocalPersistence);

  return authRef;
}

/** Offline cache so the Today screen works in a basement gym. */
export function getDb(): Firestore {
  if (dbRef) return dbRef;

  dbRef = initializeFirestore(firebaseApp(), {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(undefined),
    }),
  });

  return dbRef;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (storageRef) return storageRef;
  storageRef = getStorage(firebaseApp());
  return storageRef;
}
