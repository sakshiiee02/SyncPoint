import { useEffect } from 'react';
import { create } from 'zustand';
import { PickedPlace, PickerTarget } from '@/domain/placeMapping';

/**
 * Hands the result of the place-picker screen back to whichever screen opened it, without
 * putting non-serialisable data in navigation params.
 */
interface PlacePickerState {
  picked: { target: PickerTarget; value: PickedPlace } | null;
  setPicked: (target: PickerTarget, value: PickedPlace) => void;
  clear: () => void;
}

export const usePlacePickerStore = create<PlacePickerState>((set) => ({
  picked: null,
  setPicked: (target, value) => set({ picked: { target, value } }),
  clear: () => set({ picked: null }),
}));

/** Runs `onPicked` once when the picker returns a value for `target`. */
export function usePickedPlace(target: PickerTarget, onPicked: (value: PickedPlace) => void): void {
  const picked = usePlacePickerStore((s) => s.picked);
  useEffect(() => {
    if (picked && picked.target === target) {
      onPicked(picked.value);
      usePlacePickerStore.getState().clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, target]);
}
