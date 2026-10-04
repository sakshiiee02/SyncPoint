/**
 * Typed access to build-time environment values.
 *
 * Values are inlined by the Babel plugin in babel.config.js from `.env`, so every
 * lookup must be a literal `process.env.NAME` expression (no dynamic keys).
 * Nothing here is secret in the cryptographic sense — anything shipped inside an APK
 * can be extracted — so provider keys must be quota-limited on the provider side.
 */

export interface FirebaseEnv {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

export const ENV = {
  firebase: {
    apiKey: clean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: clean(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
    databaseURL: clean(process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL),
    projectId: clean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: clean(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: clean(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: clean(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  } as FirebaseEnv,

  /** Place search providers (Phase 3). Empty string = provider disabled. */
  geoapifyApiKey: clean(process.env.GEOAPIFY_API_KEY),
  locationIqApiKey: clean(process.env.LOCATIONIQ_API_KEY),

  /** Routing provider (Phase 3). */
  openRouteServiceApiKey: clean(process.env.OPENROUTESERVICE_API_KEY),

  /** Public https origin that serves invite links, e.g. https://syncpoint.example.com */
  inviteLinkBaseUrl: clean(process.env.INVITE_LINK_BASE_URL).replace(/\/+$/, ''),
} as const;

/** Returns the names of required Firebase settings that are missing from the environment. */
export function findMissingFirebaseSettings(config: FirebaseEnv = ENV.firebase): string[] {
  const required: Array<[keyof FirebaseEnv, string]> = [
    ['apiKey', 'EXPO_PUBLIC_FIREBASE_API_KEY'],
    ['databaseURL', 'EXPO_PUBLIC_FIREBASE_DATABASE_URL'],
    ['projectId', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'],
    ['appId', 'EXPO_PUBLIC_FIREBASE_APP_ID'],
  ];
  return required.filter(([key]) => !config[key]).map(([, envName]) => envName);
}
