import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseApp';

/**
 * Returns the persisted anonymous user, creating one only on the very first launch.
 * `authStateReady()` matters: `currentUser` is null until the stored session is restored,
 * and signing in before that would silently replace the user's identity.
 */
export async function ensureAnonymousAuth(): Promise<User> {
  const auth = getFirebaseAuth();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;

  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export function getCurrentUid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}
