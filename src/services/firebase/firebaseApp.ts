import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV, findMissingFirebaseSettings } from '@/config/env';
import { attachServerClock } from '@/data/serverClock';

/** Thrown at startup when `.env` is missing required Firebase settings. */
export class FirebaseConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(`Missing Firebase settings in .env: ${missing.join(', ')}`);
    this.name = 'FirebaseConfigError';
  }
}

export function getFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const missing = findMissingFirebaseSettings();
  if (missing.length > 0) throw new FirebaseConfigError(missing);
  return initializeApp(ENV.firebase);
}

let authInstance: Auth | null = null;

/**
 * Auth with AsyncStorage persistence. Without it the anonymous user (and therefore the
 * traveler's identity in every journey) would be re-created on each app launch.
 */
export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  try {
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized (e.g. Fast Refresh) — reuse the existing instance.
    authInstance = getAuth(app);
  }
  return authInstance;
}

let dbInstance: Database | null = null;

export function getFirebaseDb(): Database {
  if (dbInstance) return dbInstance;
  dbInstance = getDatabase(getFirebaseApp());
  attachServerClock(dbInstance);
  return dbInstance;
}
