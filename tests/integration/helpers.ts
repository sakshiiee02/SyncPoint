import { FirebaseApp, deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { Database, connectDatabaseEmulator, getDatabase, goOffline } from 'firebase/database';
import { attachServerClock } from '@/data/serverClock';
import { Destination } from '@/types/journey';
import { OriginLocation, UserProfile } from '@/types/member';

const PROJECT_ID = 'demo-syncpoint';
let counter = 0;
const apps: FirebaseApp[] = [];

export interface TestUser {
  uid: string;
  db: Database;
  profile: UserProfile;
}

/** Creates an independent anonymous Firebase user talking to the local emulators. */
export async function newUser(label: string): Promise<TestUser> {
  const app = initializeApp(
    {
      apiKey: 'fake-api-key',
      projectId: PROJECT_ID,
      databaseURL: `https://${PROJECT_ID}-default-rtdb.firebaseio.com`,
    },
    `test-user-${label}-${counter++}`
  );
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const credential = await signInAnonymously(auth);
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  attachServerClock(db);
  return {
    uid: credential.user.uid,
    db,
    profile: {
      uid: credential.user.uid,
      name: label,
      username: label.toLowerCase(),
      phone: '+910000000000',
    },
  };
}

export async function disposeAllUsers(): Promise<void> {
  const toClose = apps.splice(0);
  for (const app of toClose) goOffline(getDatabase(app));
  await Promise.all(toClose.map((app) => deleteApp(app)));
}

export const GOA: Destination = {
  lat: 15.3808,
  lng: 73.8314,
  displayName: 'Goa International Airport',
  address: 'Dabolim, Goa',
};

export const DELHI_GPS: OriginLocation = {
  kind: 'GPS',
  lat: null,
  lng: null,
  displayName: 'My current location',
};

export const JAIPUR: OriginLocation = {
  kind: 'PLACE',
  lat: 26.9124,
  lng: 75.7873,
  displayName: 'Jaipur',
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Asserts that a promise rejects with the given JourneyError code (or Firebase permission error). */
export async function rejectsWith(promise: Promise<unknown>, codeOrText: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const text = `${(error as any)?.code ?? ''} ${(error as any)?.message ?? ''}`;
    if (text.toLowerCase().includes(codeOrText.toLowerCase())) return;
    throw new Error(`Rejected, but with "${text}" instead of "${codeOrText}"`);
  }
  throw new Error(`Expected rejection containing "${codeOrText}" but it resolved`);
}
