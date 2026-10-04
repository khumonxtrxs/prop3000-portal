// Firebase app, auth, Firestore and Storage for the browser.
//
// Config values are public by design — Firestore and Storage rules do the protecting, not secrecy.
// Nothing here runs during SSR: every getter is lazy, so importing this file on the server is safe
// as long as the instance isn't touched. Server-side reads go through the Firestore REST API
// instead (see src/integrations/firebase/rest.ts), because the Cloudflare Workers runtime cannot
// run firebase-admin. That REST helper arrives with the listings migration.
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

import { FIREBASE_EMULATOR_PORTS } from "./config";

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const ENV_KEYS = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
} as const satisfies Record<keyof FirebaseConfig, string>;

function readConfig(): FirebaseConfig {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const missing: string[] = [];
  const values = {} as FirebaseConfig;

  for (const [field, envKey] of Object.entries(ENV_KEYS) as Array<[keyof FirebaseConfig, string]>) {
    const value = env[envKey];
    if (!value) missing.push(envKey);
    else values[field] = value;
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Firebase environment variable(s): ${missing.join(", ")}. Add them to .env (see .env.example).`,
    );
  }
  return values;
}

/** True when the app should talk to the local Firebase emulators instead of the real project. */
export function usingEmulators(): boolean {
  return (import.meta.env as unknown as Record<string, string | undefined>)["VITE_FIREBASE_EMULATORS"] === "true";
}

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let firestoreInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

function firebaseApp(): FirebaseApp {
  if (!app) app = getApps().length > 0 ? getApp() : initializeApp(readConfig());
  return app;
}

export function firebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(firebaseApp());
    if (usingEmulators()) {
      connectAuthEmulator(authInstance, `http://127.0.0.1:${FIREBASE_EMULATOR_PORTS.auth}`, {
        disableWarnings: true,
      });
    }
  }
  return authInstance;
}

export function firestore(): Firestore {
  if (!firestoreInstance) {
    firestoreInstance = getFirestore(firebaseApp());
    if (usingEmulators()) {
      connectFirestoreEmulator(firestoreInstance, "127.0.0.1", FIREBASE_EMULATOR_PORTS.firestore);
    }
  }
  return firestoreInstance;
}

export function firebaseStorage(): FirebaseStorage {
  if (!storageInstance) {
    storageInstance = getStorage(firebaseApp());
    if (usingEmulators()) {
      connectStorageEmulator(storageInstance, "127.0.0.1", FIREBASE_EMULATOR_PORTS.storage);
    }
  }
  return storageInstance;
}
