import { create } from 'zustand';
import { UserProfile } from '@/types/member';

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  hasCompletedProfile: boolean;
  setUid: (uid: string) => void;
  setProfile: (profile: Partial<UserProfile>) => void;
  saveProfile: (name: string, username: string, phone: string, photoUrl?: string) => void;
  clearProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: true,
  hasCompletedProfile: false,

  setUid: (uid: string) => {
    set((state) => ({
      profile: {
        uid,
        name: state.profile?.name || '',
        username: state.profile?.username || '',
        phone: state.profile?.phone || '',
        photoUrl: state.profile?.photoUrl,
      },
      isLoading: false,
    }));
  },

  setProfile: (updates) => {
    set((state) => {
      const current = state.profile || { uid: '', name: '', username: '', phone: '' };
      const updated = { ...current, ...updates };
      const hasCompleted = Boolean(updated.name && updated.phone && updated.username);
      return { profile: updated, hasCompletedProfile: hasCompleted };
    });
  },

  saveProfile: (name: string, username: string, phone: string, photoUrl?: string) => {
    const currentUid = get().profile?.uid || '';
    set({
      profile: {
        uid: currentUid,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        photoUrl,
      },
      hasCompletedProfile: true,
      isLoading: false,
    });
  },

  clearProfile: () => {
    set({ profile: null, hasCompletedProfile: false, isLoading: false });
  },
}));
