import { create } from 'zustand';
import { JourneyEvent } from '@/domain/journeyEvents';

interface ToastState {
  toasts: JourneyEvent[];
  push: (event: JourneyEvent) => void;
  dismiss: (id: string) => void;
}

const MAX_VISIBLE = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (event) => set((state) => ({ toasts: [...state.toasts, event].slice(-MAX_VISIBLE) })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
