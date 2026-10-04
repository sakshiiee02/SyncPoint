import { PlaceResult, SearchOptions } from './types';

export type TypeAheadState =
  | { status: 'idle'; results: [] }
  | { status: 'too-short'; results: [] }
  | { status: 'loading'; results: PlaceResult[] }
  | { status: 'ready'; results: PlaceResult[] }
  | { status: 'empty'; results: [] }
  | { status: 'unavailable'; results: [] }
  | { status: 'error'; results: [] };

type SearchFn = (query: string, options: SearchOptions) => Promise<PlaceResult[]>;

/**
 * Search-as-you-type behaviour, independent of React:
 *  - waits for a pause in typing (debounce) so one word isn't five requests,
 *  - cancels the in-flight request when the text changes,
 *  - ignores any answer that arrives for text the user has already changed (latest wins),
 *  - keeps showing the previous results while the next ones load (no flicker).
 */
export class TypeAheadController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private generation = 0;
  private lastResults: PlaceResult[] = [];

  constructor(
    private readonly search: SearchFn,
    private readonly onState: (state: TypeAheadState) => void,
    private readonly options: {
      debounceMs?: number;
      minLength?: number;
      isUnavailable?: (error: unknown) => boolean;
    } = {}
  ) {}

  setQuery(query: string, bias?: { lat: number; lng: number }): void {
    const minLength = this.options.minLength ?? 3;
    const text = query.trim();

    this.cancelPending();
    const generation = ++this.generation;

    if (text.length === 0) {
      this.lastResults = [];
      this.onState({ status: 'idle', results: [] });
      return;
    }
    if (text.length < minLength) {
      this.lastResults = [];
      this.onState({ status: 'too-short', results: [] });
      return;
    }

    this.onState({ status: 'loading', results: this.lastResults });
    this.timer = setTimeout(() => this.run(text, bias, generation), this.options.debounceMs ?? 300);
  }

  dispose(): void {
    this.cancelPending();
    this.generation++;
  }

  private cancelPending(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.abort?.abort();
    this.abort = null;
  }

  private async run(
    text: string,
    bias: { lat: number; lng: number } | undefined,
    generation: number
  ): Promise<void> {
    const controller = new AbortController();
    this.abort = controller;
    try {
      const results = await this.search(text, { bias, signal: controller.signal });
      if (generation !== this.generation) return;
      this.lastResults = results;
      this.onState(results.length > 0 ? { status: 'ready', results } : { status: 'empty', results: [] });
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      this.lastResults = [];
      this.onState(
        this.options.isUnavailable?.(error)
          ? { status: 'unavailable', results: [] }
          : { status: 'error', results: [] }
      );
    }
  }
}
