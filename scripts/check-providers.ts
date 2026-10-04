/**
 * Manual smoke test for the real third-party services, using the keys in .env.
 *   npm run check:providers
 * Prints counts and statuses only: never the keys themselves.
 */
import fs from 'node:fs';
import path from 'node:path';
import { GeoapifyProvider } from '@/services/places/geoapifyProvider';
import { LocationIqProvider } from '@/services/places/locationIqProvider';
import { OpenRouteServiceProvider } from '@/services/routing/providers/openRouteService';
import { OsrmProvider } from '@/services/routing/providers/osrm';
import { CONFIG } from '@/constants/config';

function loadEnv(): Record<string, string> {
  const file = path.resolve(process.cwd(), '.env');
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const env = loadEnv();
const delhi = { lat: 28.6139, lng: 77.209 };
const jaipur = { lat: 26.9124, lng: 75.7873 };

async function check(name: string, run: () => Promise<string>) {
  try {
    console.log(`PASS  ${name}: ${await run()}`);
  } catch (error) {
    console.log(`FAIL  ${name}: ${(error as Error).message}`);
    process.exitCode = 1;
  }
}

async function main() {
  const geoapify = new GeoapifyProvider(env.GEOAPIFY_API_KEY ?? '');
  const locationIq = new LocationIqProvider(env.LOCATIONIQ_API_KEY ?? '');
  const ors = new OpenRouteServiceProvider(env.OPENROUTESERVICE_API_KEY ?? '', CONFIG.ROUTING.ORS_BASE_URL);
  const osrm = new OsrmProvider(CONFIG.ROUTING.OSRM_BASE_URLS);

  console.log(
    `keys present: geoapify=${geoapify.isConfigured} locationiq=${locationIq.isConfigured} ors=${ors.isConfigured}`
  );

  if (geoapify.isConfigured) {
    await check('Geoapify autocomplete "goa air"', async () => {
      const r = await geoapify.search('goa air', { bias: { lat: 15.4, lng: 73.9 } });
      return `${r.length} results, first: ${r[0]?.name} (${r[0]?.address})`;
    });
    await check('Geoapify autocomplete "amber pal"', async () => {
      const r = await geoapify.search('amber pal');
      return `${r.length} results, first: ${r[0]?.name}`;
    });
    await check('Geoapify reverse (Delhi)', async () => {
      const r = await geoapify.reverse(delhi.lat, delhi.lng);
      return `${r?.name} / ${r?.address}`;
    });
  }
  if (locationIq.isConfigured) {
    await check('LocationIQ autocomplete "goa air"', async () => {
      const r = await locationIq.search('goa air');
      return `${r.length} results, first: ${r[0]?.name} (${r[0]?.address})`;
    });
    await check('LocationIQ reverse (Delhi)', async () => {
      const r = await locationIq.reverse(delhi.lat, delhi.lng);
      return `${r?.name} / ${r?.address}`;
    });
  }
  if (ors.isConfigured) {
    for (const mode of ['CAR', 'BIKE', 'WALK'] as const) {
      await check(`OpenRouteService ${mode} Delhi->Jaipur`, async () => {
        const r = await ors.getRoute(delhi, jaipur, mode);
        return `${Math.round(r.distanceM / 1000)} km, ${Math.round(r.durationS / 60)} min, ${r.steps.length} steps, ${r.geometry.coordinates.length} pts`;
      });
    }
  }
  for (const mode of ['CAR', 'BIKE', 'WALK'] as const) {
    await check(`Public OSRM fallback ${mode} (short hop)`, async () => {
      const r = await osrm.getRoute(delhi, { lat: 28.6304, lng: 77.2177 }, mode);
      return `${Math.round(r.distanceM)} m, ${Math.round(r.durationS / 60)} min, ${r.steps.length} steps`;
    });
  }
}

main();
