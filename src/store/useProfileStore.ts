import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@/types/member';

const STORAGE_KEY = '@syncpoint_user_profile';

/** The editable part of the profile. The uid is never stored here: it always comes from Firebase Auth. */
type StoredProfile = Pick<UserProfile, 'name' | 'username' | 'phone' | 'photoUrl'>;

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
  saveProfile: (name: string, username: string, phone: string, photoUrl?: string) => void;
  clearProfile: () => void;
}

function isComplete(details: StoredProfile | null): details is StoredProfile {
  return Boolean(details && details.name.trim() && details.username.trim() && details.phone.trim());
}

function derive(uid: string | null, details: StoredProfile | null) {
  const complete = isComplete(details);
  return {
    hasCompletedProfile: complete,
    profile: uid && complete ? ({ uid, ...details } as UserProfile) : null,
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

  saveProfile: (name, username, phone, photoUrl) => {
    const details: StoredProfile = {
      name: name.trim(),
      username: username.trim().toLowerCase(),
      phone: phone.trim(),
      ...(photoUrl ? { photoUrl } : {}),
    };
    set({ details, isLoading: false, ...derive(get().uid, details) });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(details)).catch(() => {});
  },

  clearProfile: () => {
    set({ details: null, profile: null, hasCompletedProfile: false, isLoading: false });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
