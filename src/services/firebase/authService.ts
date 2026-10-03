import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirebaseAuth } from './firebaseApp';

/**
 * Handles anonymous Firebase authentication for zero-friction onboarding
 * while maintaining stable UIDs for Realtime Database security rules.
 * Matches Section 5.1 & 7.3 of Developer Handoff.
 */
export async function ensureAnonymousAuth(): Promise<User> {
  const auth = getFirebaseAuth();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    const credential = await signInAnonymously(auth);
    return credential.user;
  } catch (error) {
    console.error('[SyncPoint Auth] Failed to sign in anonymously:', error);
    throw error;
  }
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUid(): string | null {
  const auth = getFirebaseAuth();
  return auth.currentUser ? auth.currentUser.uid : null;
}
