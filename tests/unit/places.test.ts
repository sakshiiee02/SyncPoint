import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeoapifyProvider, mapGeoapifyItem } from '@/services/places/geoapifyProvider';
import { LocationIqProvider, mapLocationIqItem } from '@/services/places/locationIqProvider';
import {
  PlaceSearchService,
  RecentPlaces,
  SearchUnavailableError,
} from '@/services/places/placeSearchService';
import { TypeAheadController, TypeAheadState } from '@/services/places/typeahead';
import { GeocoderProvider, PlaceResult } from '@/services/places/types';
import { QuotaGuard } from '@/services/storage/quotaGuard';
import { MemoryStore } from '@/services/storage/keyValueStore';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const place = (id: string, provider: PlaceResult['provider'] = 'geoapify'): PlaceResult => ({
  id,
  name: id,
  address: `${id}, India`,
  lat: 15.38,
  lng: 73.83,
  provider,
});

function fakeProvider(name: 'geoapify' | 'locationiq', behaviour: 'ok' | 'fail' | 'empty', configured = true) {
  const state = { calls: 0, queries: [] as string[] };
  const provider: GeocoderProvider = {
    name,
    isConfigured: configured,
    async search(query) {
      state.calls++;
      state.queries.push(query);
      if (behaviour === 'fail') throw new Error('boom');
      return behaviour === 'empty' ? [] : [place(`${name}:${query}`, name)];
    },
    async reverse() {
      state.calls++;
      if (behaviour === 'fail') throw new Error('boom');
      return place(`${name}:rev`, name);
    },
  };
  return { provider, state };
}

const quota = (limits = { geoapify: 100, locationiq: 100 }) => new QuotaGuard(new MemoryStore(), limits);

describe('provider response mapping', () => {
  it('maps Geoapify results', () => {
    const mapped = mapGeoapifyItem({
      place_id: 'abc',
      lat: 15.3808,
      lon: 73.8314,
      name: 'Goa International Airport',
      address_line2: 'Dabolim, Goa, India',
      formatted: 'Goa International Airport, Dabolim, Goa, India',
    });
    assert.deepEqual(mapped, {
      id: 'abc',
      name: 'Goa International Airport',
      address: 'Dabolim, Goa, India',
      lat: 15.3808,
      lng: 73.8314,
      provider: 'geoapify',
    });
    assert.equal(mapGeoapifyItem({ lat: NaN as any, lon: undefined as any }), null);
  });

  it('maps LocationIQ results (string coordinates)', () => {
    const mapped = mapLocationIqItem({
      place_id: '77',
      lat: '26.9855',
      lon: '75.8513',
      display_place: 'Amber Palace',
      display_address: 'Amer, Jaipur, Rajasthan, India',
    });
    assert.equal(mapped?.name, 'Amber Palace');
    assert.equal(mapped?.lat, 26.9855);
    assert.equal(mapped?.provider, 'locationiq');
    assert.equal(mapLocationIqItem({ lat: 'x', lon: 'y' }), null);
  });

  it('Geoapify sends the query, bias and key; LocationIQ treats 404 as "no matches"', async () => {
    let url = '';
    const geo = new GeoapifyProvider('GKEY', async (u) => {
      url = u;
      return new Response(JSON.stringify({ results: [{ lat: 1, lon: 2, name: 'A' }] }), { status: 200 });
    });
    const out = await geo.search('goa air', { bias: { lat: 15, lng: 73 }, limit: 4 });
    assert.equal(out.length, 1);
    assert.match(url, /autocomplete\?/);
    assert.match(url, /text=goa%20air/);
    assert.match(url, /bias=proximity%3A73%2C15/);
    assert.doesNotMatch(url, /undefined/);
    assert.match(url, /apiKey=GKEY/);
    assert.match(url, /limit=4/);

    const liq = new LocationIqProvider('LKEY', async () => new Response('{}', { status: 404 }));
    assert.deepEqual(await liq.search('zzzzzz'), []);
    const broken = new LocationIqProvider('LKEY', async () => new Response('', { status: 429 }));
    await assert.rejects(broken.search('goa'), /429/);
  });
});

describe('PlaceSearchService', () => {
  it('ignores short queries and caches repeats', async () => {
    const geo = fakeProvider('geoapify', 'ok');
    const service = new PlaceSearchService([geo.provider], quota());
    assert.deepEqual(await service.search('go'), []);
    assert.equal(geo.state.calls, 0);
    await service.search('Goa Airport');
    await service.search('  goa   airport ');
    assert.equal(geo.state.calls, 1); // normalised + cached
  });

  it('falls back to the second provider when the first fails', async () => {
    const geo = fakeProvider('geoapify', 'fail');
    const liq = fakeProvider('locationiq', 'ok');
    const results = await new PlaceSearchService([geo.provider, liq.provider], quota()).search('jaipur');
    assert.equal(results[0].provider, 'locationiq');
    assert.equal(geo.state.calls, 1);
  });

  it('does not treat an empty answer as a failure', async () => {
    const geo = fakeProvider('geoapify', 'empty');
    const liq = fakeProvider('locationiq', 'ok');
    assert.deepEqual(await new PlaceSearchService([geo.provider, liq.provider], quota()).search('nowhere'), []);
    assert.equal(liq.state.calls, 0);
  });

  it('skips unconfigured providers and ones over their daily share', async () => {
    const geo = fakeProvider('geoapify', 'ok', false);
    const liq = fakeProvider('locationiq', 'ok');
    const service = new PlaceSearchService([geo.provider, liq.provider], quota());
    assert.equal((await service.search('delhi'))[0].provider, 'locationiq');
    assert.equal(geo.state.calls, 0);

    const geo2 = fakeProvider('geoapify', 'ok');
    const liq2 = fakeProvider('locationiq', 'ok');
    const limited = new PlaceSearchService([geo2.provider, liq2.provider], quota({ geoapify: 1, locationiq: 100 }));
    assert.equal((await limited.search('first query'))[0].provider, 'geoapify');
    assert.equal((await limited.search('second query'))[0].provider, 'locationiq');
  });

  it('reports unavailability when every provider is down or missing', async () => {
    const service = new PlaceSearchService(
      [fakeProvider('geoapify', 'fail').provider, fakeProvider('locationiq', 'ok', false).provider],
      quota()
    );
    await assert.rejects(service.search('mumbai'), SearchUnavailableError);
    assert.equal(new PlaceSearchService([fakeProvider('geoapify', 'ok', false).provider], quota()).isAvailable, false);
  });

  it('reverse geocodes through the same fallback chain', async () => {
    const service = new PlaceSearchService(
      [fakeProvider('geoapify', 'fail').provider, fakeProvider('locationiq', 'ok').provider],
      quota()
    );
    assert.equal((await service.reverse(15, 73))?.provider, 'locationiq');
  });
});

describe('RecentPlaces', () => {
  it('keeps the latest picks first, de-duplicated and capped, skipping map pins', async () => {
    const recents = new RecentPlaces(new MemoryStore(), 'k', 3);
    await recents.add(place('a'));
    await recents.add(place('b'));
    await recents.add(place('a'));
    await recents.add(place('c'));
    await recents.add(place('d'));
    await recents.add(place('pin', 'map'));
    assert.deepEqual((await recents.list()).map((p) => p.id), ['d', 'c', 'a']);
  });
});

describe('type-ahead behaviour', () => {
  const collect = () => {
    const states: TypeAheadState[] = [];
    return { states, onState: (s: TypeAheadState) => states.push(s) };
  };

  it('waits for a pause in typing: five keystrokes make one request', async () => {
    const seen: string[] = [];
    const { states, onState } = collect();
    const controller = new TypeAheadController(
      async (q) => {
        seen.push(q);
        return [place(q)];
      },
      onState,
      { debounceMs: 30 }
    );
    for (const text of ['goa', 'goa ', 'goa a', 'goa ai', 'goa air']) controller.setQuery(text);
    await sleep(120);
    assert.deepEqual(seen, ['goa air']);
    assert.equal(states[states.length - 1].status, 'ready');
  });

  it('shows too-short for 1-2 letters and idle for nothing', () => {
    const { states, onState } = collect();
    const controller = new TypeAheadController(async () => [], onState, { debounceMs: 10 });
    controller.setQuery('go');
    controller.setQuery('');
    assert.deepEqual(states.map((s) => s.status), ['too-short', 'idle']);
  });

  it('latest typing wins: a slow answer for old text is discarded', async () => {
    const { states, onState } = collect();
    const controller = new TypeAheadController(
      async (q) => {
        await sleep(q === 'old query' ? 80 : 5);
        return [place(q)];
      },
      onState,
      { debounceMs: 5 }
    );
    controller.setQuery('old query');
    await sleep(20); // old request is now in flight
    controller.setQuery('new query');
    await sleep(150);
    const ready = states.filter((s) => s.status === 'ready');
    assert.equal(ready.length, 1);
    assert.equal(ready[0].results[0].id, 'new query');
  });

  it('distinguishes empty, unavailable and error outcomes', async () => {
    const run = async (fn: () => Promise<PlaceResult[]>) => {
      const { states, onState } = collect();
      const controller = new TypeAheadController(fn, onState, {
        debounceMs: 5,
        isUnavailable: (e) => e instanceof SearchUnavailableError,
      });
      controller.setQuery('abcdef');
      await sleep(40);
      return states[states.length - 1].status;
    };
    assert.equal(await run(async () => []), 'empty');
    assert.equal(await run(async () => Promise.reject(new SearchUnavailableError())), 'unavailable');
    assert.equal(await run(async () => Promise.reject(new Error('x'))), 'error');
  });

  it('stops everything on dispose', async () => {
    let calls = 0;
    const controller = new TypeAheadController(async () => (calls++, []), () => undefined, { debounceMs: 20 });
    controller.setQuery('mumbai');
    controller.dispose();
    await sleep(60);
    assert.equal(calls, 0);
  });
});
