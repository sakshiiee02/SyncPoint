import { useEffect, useRef, useState } from 'react';
import {
  MIN_QUERY_LENGTH,
  SearchUnavailableError,
  placeSearch,
} from '@/services/places';
import { TypeAheadController, TypeAheadState } from '@/services/places/typeahead';

/** Search-as-you-type for places. Call `setQuery` from a TextInput's onChangeText. */
export function usePlaceSearch(bias?: { lat: number; lng: number }) {
  const [state, setState] = useState<TypeAheadState>({ status: 'idle', results: [] });
  const biasRef = useRef(bias);
  biasRef.current = bias;
  const controllerRef = useRef<TypeAheadController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new TypeAheadController(
      (query, options) => placeSearch.search(query, options),
      setState,
      {
        debounceMs: 300,
        minLength: MIN_QUERY_LENGTH,
        isUnavailable: (error) => error instanceof SearchUnavailableError,
      }
    );
  }

  useEffect(() => () => controllerRef.current?.dispose(), []);

  return {
    state,
    setQuery: (query: string) => controllerRef.current?.setQuery(query, biasRef.current),
  };
}
