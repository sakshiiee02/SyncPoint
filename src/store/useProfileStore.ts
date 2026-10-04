import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/types/member';
import { Mascot, defaultMascot, normalizeMascot } from '@/domain/mascot';

const STORAGE_KEY = '@syncpoint_user_profile';

/** The editable part of the profile. The uid is never stored here: it always comes from Firebase Auth. */
type StoredProfile = Pick<UserProfile, 'name' | 'username' | 'phone' | 'photoUrl' | 'mascot'>;

interface ProfileState {
  /** Null until Firebase auth has produced a uid. */
  uid: string | null;
  details: StoredProfile | null;
  isLoading: boolean;
  /** Full profile once both identity and details exist. */
  profile: UserProfile | null;
  hasCompletedProfile: boolean;

  initProfile: () => Promise<void>;
  setUid: (uid: string) => void;
  saveProfile: (name: string, username: string, phone: string, mascot?: Mascot) => void;
  clearProfile: () => void;
}

function isComplete(details: StoredProfile | null): details is StoredProfile {
  return Boolean(details && details.name.trim() && details.username.trim() && details.phone.trim());
}

function derive(uid: string | null, details: StoredProfile | null) {
  const complete = isComplete(details);
  return {
    hasCompletedProfile: complete,
    // Everyone always has a mascot: one they made, or a stable default picked from their id.
    profile:
      uid && complete
        ? ({ uid, ...details, mascot: details.mascot ?? defaultMascot(uid) } as UserProfile)
        : null,
  };
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  uid: null,
  details: null,
  isLoading: true,
  profile: null,
  hasCompletedProfile: false,

  initProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as StoredProfile;
        if (isComplete(stored)) {
          if (stored.mascot) stored.mascot = normalizeMascot(stored.mascot, stored.username);
          set({ details: stored, isLoading: false, ...derive(get().uid, stored) });
          return;
        }
      }
    } catch {
      // Unreadable storage: treat as a first launch.
    }
    set({ isLoading: false });
  },

  setUid: (uid) => {
    if (!uid.trim()) return;
    set({ uid, ...derive(uid, get().details) });
  },

  saveProfile: (name, username, phone, mascot) => {
    const details: StoredProfile = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: phone.trim(),
      ...(mascot ? { mascot } : get().details?.mascot ? { mascot: get().details!.mascot } : {}),
    };
    set({ details, isLoading: false, ...derive(get().uid, details) });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(details)).catch(() => {});
  },

  clearProfile: () => {
    set({ details: null, profile: null, hasCompletedProfile: false, isLoading: false });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
