# SyncPoint

> **"We are all traveling somewhere together. Put everyone on one map."**

SyncPoint is a free Android app for groups of friends who travel to the **same destination from different places**. One person creates a *journey* and picks the destination; everyone joins with a short code, chooses their own starting point and travel mode (car, bike or walking), and then sees **all friends on one live map**: where they are, how far they have left, when they will arrive, their speed and battery, and whether they are stopped for fuel or in trouble.

It is built to cost **nothing to run**: no paid servers, no Cloud Functions, no paid map or routing APIs. Everything runs on free tiers (Firebase Spark, OpenFreeMap, OpenRouteService, Geoapify, LocationIQ).

---

## Contents

1. [What the app does](#1-what-the-app-does)
2. [How a journey works](#2-how-a-journey-works)
3. [Tech stack](#3-tech-stack)
4. [Architecture](#4-architecture)
5. [Project layout](#5-project-layout)
6. [Data model and security](#6-data-model-and-security)
7. [Location tracking (Android native)](#7-location-tracking-android-native)
8. [Navigation, ETA and arrival](#8-navigation-eta-and-arrival)
9. [Place search and routing providers](#9-place-search-and-routing-providers)
10. [Offline behaviour](#10-offline-behaviour)
11. [Alerts and notifications](#11-alerts-and-notifications)
12. [Setup guide](#12-setup-guide)
13. [Building and installing](#13-building-and-installing)
14. [Testing](#14-testing)
15. [Staying within the free tiers](#15-staying-within-the-free-tiers)
16. [Troubleshooting and gotchas](#16-troubleshooting-and-gotchas)
17. [Documentation index](#17-documentation-index)

---

## 1. What the app does

| Area | Details |
| :--- | :--- |
| **Journeys** | One shared destination, up to **10 travelers** (including the creator), creator-chosen expiry (12–72 h). |
| **Joining** | A 6-character code (e.g. `K7M2QX`) or an invite link (`syncpoint://join/CODE`, or `https://<your-domain>/join/CODE` once a domain is configured). |
| **Identity** | No sign-up. Firebase *anonymous* auth gives each install a stable ID; you only enter a name, username and phone (the phone is visible to journey members so they can call you). |
| **Starting point** | Per traveler, editable until they press Start: **current GPS**, a **searched place**, or a **pin dropped on the map**. |
| **Mascots** | Everyone creates their own mascot in **Profile** (10 animals × 10 background colours, live preview). It is their marker on the map and their avatar in the roster, lobby and traveler card. Nobody is ever blank: people who haven't made one get a stable default. |
| **Live map** | Everyone's position, speed, battery %, charging state, current road, distance and ETA remaining, "last seen", and quick status ("Fuel stop", "Need help"…). |
| **Everyone's routes** | Each traveler's route is shared with the group and drawn on every map in their own colour (a matching colour dot sits next to their name in the roster). Your route stays primary; tap a friend to highlight theirs. |
| **Navigation** | Turn-by-turn banner and **voice guidance** (Android text-to-speech), automatic re-routing when you leave the route, separate profiles for car / bike / foot. |
| **Coordination** | Group chat, quick status chips, call a traveler, emergency sheet, "navigate to this traveler". |
| **Pause** | Pause sharing without stopping your own navigation; friends see "Paused · last seen…". |
| **Late joiners** | Friends can join a journey that has already started; if the creator leaves, ownership passes to the longest-standing member. |
| **Offline** | Real offline map download for your route, local trip recording, chat queued while offline, automatic catch-up on reconnect. |
| **History** | Real recorded tracks and stats (distance, duration, average and max speed) stored privately on your phone, with replay. |
| **Alerts** | In-app banners (and Android notifications in the background) when someone joins, arrives, needs help or has a low battery. |

---

## 2. How a journey works

### Journey states

```
LOBBY ──(first traveler presses Start)──▶ ACTIVE ──▶ COMPLETED   (last traveler finishes, or the creator ends it)
  │                                          └──────▶ EXPIRED     (server time passes the expiry)
  └──(creator cancels / sole member leaves)──────────▶ CANCELLED
```

### Traveler states

Every traveler has one explicit state. **The UI derives "not started / on the way / arrived" only from this state, never from distance or from whether a location exists.** (An earlier version showed waiting friends as "arrived" because their missing distance defaulted to 0.)

```
WAITING ──Start──▶ TRAVELING ⇄ PAUSED
                      │            │
                      ├──Arrive────┴──▶ ARRIVED ──Finish──▶ FINISHED
                      └──Finish────────────────────────────▶ FINISHED
(leaving a journey removes the member and frees their seat)
```

The transition table lives in `src/domain/travelerState.ts` and is **enforced a second time by the database rules**, so a modified client cannot cheat.

### Typical flow

1. **Create**: name, destination (search or map pin), your start point, your travel mode, expiry → you land in the **lobby** with the invite code.
2. **Join**: friends enter the code → preview of the journey → choose start point and mode → lobby.
3. **Start** (per person, any time): the app asks for location permission, takes a real GPS fix, marks you `TRAVELING`, starts the Android foreground service and begins sharing.
4. **Travel**: live map, navigation, chat, statuses. Press *Home* or lock the phone; sharing continues.
5. **Arrive**: when you are inside the arrival radius for two consecutive accurate fixes you are marked `ARRIVED` and asked whether to finish; you keep sharing until you press Finish.
6. **Finish / Leave / End**: *Finish* stops your sharing but leaves the journey running for others; *Leave* removes you; the creator can *End for everyone*. The trip is saved to your phone's history.

### Back button behaviour

Back from the lobby or the live map returns to **Home while the journey keeps running**; Home shows a **Resume Journey** card. If Android kills the app mid-trip, reopening it drops you straight back into the journey and restarts GPS. Leaving or ending a journey is always an explicit button.

---

## 3. Tech stack

| Layer | Technology |
| :--- | :--- |
| App | **React Native 0.78** (TypeScript, strict), Hermes, old architecture |
| Navigation | `@react-navigation/native` + native-stack (`react-native-screens` **pinned to 4.10.0**) |
| State | Zustand (small, read-only mirrors of live data) |
| Maps | `@maplibre/maplibre-react-native` with **OpenFreeMap** vector tiles (no key) |
| Backend | **Firebase Realtime Database + Anonymous Auth** on the free **Spark** plan, *no Cloud Functions* |
| Place search | **Geoapify** (primary) and **LocationIQ** (automatic fallback) |
| Routing | **OpenRouteService** (primary) → public **OSRM** (fallback) → labelled straight-line estimate |
| Local storage | SQLite via `@op-engineering/op-sqlite` (route cache, recorded track, chat outbox), AsyncStorage (profile, history, quotas) |
| Native Android | Kotlin: foreground location service, Fused Location, battery, text-to-speech, notifications |
| Tests | Node's built-in test runner + `tsx`, Firebase emulators for security rules |
| Landing page | Vite (`index.html`, `src/web`), deployed separately |

---

## 4. Architecture

The app is organised in layers; each layer only talks to the one below it.

```
screens (src/features/*)          Thin UI. Read stores, call actions. No Firebase code.
   │
navigation (src/app)              React Navigation stack, boot/resume logic, invite links, "journey ended" handling
   │
tracking (src/tracking)           trackingController: GPS fix → route progress → ETA → voice → arrival → publish
   │                              journeyTracking: the Start flow and resume-after-restart
session (src/session)             journeySession: the single live subscription (meta, members, live) + end detection + alerts
   │                              journeyActions: create / join / start / finish / leave / end (repository + session + store)
data (src/data)                   journeyRepository, userJourneyRepository: the only code that writes journey data
   │                              paths.ts (schema), serialization.ts, serverClock.ts, errors.ts
domain (src/domain)               Pure, unit-tested rules (no React, no Firebase)
```

### Principles

* **Screens only display.** GPS, routing, voice, arrival and publishing live in the `trackingController`, so they keep working when a screen is closed or the user is on Home.
* **One live subscription.** `journeySession` owns the Firebase listeners. Screens read Zustand stores that the session keeps current; there are no per-screen subscriptions to leak.
* **Pure domain layer.** Traveler state machine, seat allocation, join codes, ownership hand-off, route progress, ETA, arrival detection, the roster view-model, tile maths, alert detection and invite-link parsing are plain functions/classes with unit tests.
* **Repositories take a `Database`**, so the exact production code is tested against the Firebase emulator.
* **Honest data.** Unknown values are `null` and shown as "--". Nothing is defaulted to a made-up number (battery 90%, Delhi coordinates, "Highway Corridor"…).
* **Server time is authoritative.** Timestamps and expiry use Firebase's server clock (`.info/serverTimeOffset`), so a phone with a wrong clock cannot break or extend a journey.

### Key modules

| Module | Responsibility |
| :--- | :--- |
| `domain/travelerState.ts` | Allowed traveler transitions (`START`, `PAUSE`, `RESUME`, `ARRIVE`, `FINISH`, `LEAVE`). |
| `domain/seats.ts` | The 10-seat mechanism that enforces the member cap. |
| `domain/participantView.ts` | Builds the roster/map model from members + live data (state-driven). |
| `domain/routeProgress.ts` | Projects a position onto the route polyline: distance *along the road*, off-route detection. |
| `domain/eta.ts` | ETA from remaining route distance, blending planner speed with the traveler's real pace. |
| `domain/arrival.ts` | `ArrivalDetector`: needs several consecutive accurate fixes inside a per-mode radius. |
| `domain/journeyEvents.ts` | Turns roster/live changes into alerts (joined, arrived, needs help, low battery, new host). |
| `domain/mascot.ts` | The 10 animals and colours, stable defaults, validation of anything read from storage or the network. |
| `domain/polyline.ts`, `domain/routeSharing.ts` | Compact encoding of a route for sharing, size cap, per-seat route colours. |
| `domain/tileMath.ts` | Offline-map region planning under MapLibre's tile cap. |
| `data/journeyRepository.ts` | Create/join (atomic with seat claim), start, change state, finish, leave (with host hand-off), end, remove member. |
| `session/journeySession.ts` | Subscriptions, expiry timer, "removed / ended" detection, alert delivery. |
| `tracking/trackingController.ts` | Everything that must happen while on the road. |
| `services/places/*` | Geocoder providers, fallback + caching + daily rationing, type-ahead controller. |
| `services/routing/*` | Route providers, route service (cache, fallback, estimate), navigation engine, voice prompts. |
| `services/connectivity.ts` | Firebase connection state, reconnect hooks. |
| `db/*` | SQLite schema and typed `LocalStore`. |

---

## 5. Project layout

```
.
├── index.js                      App entry (registers RootNavigator)
├── database.rules.json           Firebase Realtime Database security rules (schema v2)
├── firebase.json                 Emulator + rules config
├── babel.config.js, metro.config.js   Inline .env values at bundle time
├── .env.example                  Every setting, documented (copy to .env)
├── android/                      Gradle project + Kotlin native module
│   └── app/src/main/java/com/syncpoint/
│       ├── MainActivity.kt, MainApplication.kt
│       └── location/             JourneyLocationService, LocationEngine, LocationBridgeModule,
│                                 AdaptiveSamplingPolicy, BatteryReader, NotificationController, LocationPackage
├── src/
│   ├── app/                      RootNavigator, routes, useBootstrap, BootScreen
│   ├── features/                 home, profile, places (picker), journey/{create,join,lobby,active,chat,history}
│   ├── tracking/                 trackingController, journeyTracking
│   ├── session/                  journeySession, journeyActions
│   ├── data/                     repositories, paths, serialization, serverClock, errors
│   ├── domain/                   pure rules (see table above)
│   ├── services/                 firebase/, location/, places/, routing/, offlineMaps/, notifications/, storage/, connectivity
│   ├── db/                       sql.ts, schema.ts, localStore.ts, sqliteClient.ts
│   ├── store/                    Zustand stores
│   ├── components/               map/, common/ (icons, mascot avatar, place field, toast host…)
│   ├── hooks/                    useNow, usePlaceSearch
│   ├── config/env.ts             Typed access to .env values
│   ├── constants/config.ts       Tunable constants (cap, radii, intervals, quotas, URLs)
│   ├── types/, utils/            Shared types and helpers
│   └── web/                      Landing page assets
├── tests/
│   ├── unit/                     Pure-logic and service tests (real source code)
│   └── integration/              Journey flows + security rules against the Firebase emulator
├── scripts/check-providers.ts    Live smoke test of every third-party service
└── docs/                         architecture.md, firebase-rules.md, original handoff specs
```

---

## 6. Data model and security

Full detail: [`docs/firebase-rules.md`](docs/firebase-rules.md). Summary of the Realtime Database (schema v2):

```
/joinCodes/{CODE}                  { journeyId, expiresAt }               lookup by exact key only (no listing)
/userJourney/{uid}                 { journeyId, joinedAt, expiresAt }     the ONE journey this user is in
/journeys/{journeyId}/
    meta       name, status, creatorUid, joinCode, createdAt, startedAt?, expiresAt, destination, schemaVersion
    seats/{0..9}   uid                                                    enforces the 10-member cap
    members/{uid}  name, username, phone, mascot{animal,color}, seat, origin, travelMode, state, joinedAt, startedAt?, finishedAt?
    live/{uid}     lat, lng, heading, speedMps, batteryPct?, charging?, status, lastUpdatedAt, currentRoad,
                   distanceRemainingM, etaEpochMs, routeVersion, isSharing
    routes/{uid}   polyline (encoded, simplified), distanceM, durationS, version, source, updatedAt
    chat/{messageId}
```

**There is no server code.** Everything that normally needs a backend is enforced by the database rules plus atomic multi-path writes:

| Guarantee | How |
| :--- | :--- |
| Max 10 travelers | Ten *seat* slots; a seat can only be written while empty, so two people racing for the last seat cannot both win. A member record is only valid if it points at a seat holding the writer's ID. |
| One active journey per user | `userJourney/{uid}` cannot be overwritten while it points at a live journey the user still belongs to. |
| Only members read journey data | Members, live positions and chat are readable only by members; phone numbers never leave the membership boundary. |
| Expiry | Rules compare with *server* time; live writes stop at `expiresAt` for every client, even offline ones. |
| Legal state changes only | A waiting traveler cannot jump to `ARRIVED` or publish a location; seat, join time and (after start) origin/mode are immutable. |
| Immutable destination | Writing `meta/destination` after creation is rejected. |
| Range-checked data | Latitude/longitude/battery/speed fields are validated; chat is write-once; mascot animal and colour must be from the allowed set; a shared route is capped at 100 KB and only its owner (while on the road) can write it. |

These rules are tested with the real rules file against the Firebase emulator (`npm run test:integration`), including simultaneous joins for the last seat, tampering attempts, expiry, host hand-off and the full finish flow.

---

## 7. Location tracking (Android native)

Kotlin code in `android/app/src/main/java/com/syncpoint/location/`:

* **`JourneyLocationService`**: a foreground service (`foregroundServiceType="location"`, Android 14 compliant) with a persistent notification (Pause/Resume). Started only from a visible *Start Journey* action. If Android restarts it with no app attached it stops itself rather than burning battery.
* **`LocationEngine`**: uses Google's **Fused Location Provider** (accuracy + battery efficiency), falling back to the platform `LocationManager` on devices without Play Services. Drops fixes with accuracy worse than 500 m.
* **`AdaptiveSamplingPolicy`**: decides which fixes are worth *publishing*: every 2.5 s at highway speed, 5 s in city traffic, 8 s when slow, 25 s when stationary, plus on 30 m moved or a 25° heading change. This is the single place publish-gating happens. Every fix is still delivered to the app so the traveler's own navigation is smooth.
* **`BatteryReader`**: the device's **real battery percentage and charging state**, attached to every location event (the first version had a hard-coded 90%).
* **`LocationBridgeModule`**: the React Native bridge: `startTracking`, `pauseTracking`, `resumeTracking`, `finishTracking`, one-shot `getCurrentPosition` (used for "current location" starts), `speak`/`stopSpeaking` (Android TextToSpeech with navigation audio attributes), and `notify` (journey alerts).

JavaScript side: `services/location/LocationBridge.ts` wraps the module; `tracking/trackingController.ts` consumes the events.

---

## 8. Navigation, ETA and arrival

* **Route following** (`domain/routeProgress.ts`, `services/routing/navigationEngine.ts`): each GPS fix is projected onto the route polyline, giving the distance remaining **along the road**, the current step, distance to the next manoeuvre and the road name. A window around the previous position keeps this cheap on very long routes.
* **Re-routing:** if the traveler is more than 75 m from the route, a fresh route is requested (cooldown 20 s). While following a temporary "navigate to a friend" route, the shared route still drives the numbers published to the group.
* **ETA** (`domain/eta.ts`): remaining distance ÷ a speed blended 60/40 from the traveler's smoothed real pace and the route planner's average, clamped to 0.5×–1.5× of the planner so a fuel stop doesn't produce an absurd ETA.
* **Arrival** (`domain/arrival.ts`): radius by mode (car 120 m, bike 80 m, walk 50 m), requiring two consecutive fixes with accuracy ≤ 100 m. It fires once, moves you to `ARRIVED`, and prompts you to finish. Paused travelers don't auto-arrive.
* **Voice** (`voiceGuidanceService.ts`): announces each manoeuvre once per distance tier (~800 m, ~250 m, "now"). Skipped for estimated straight-line routes, which have no real turns.
* **Everyone's routes.** When a route is loaded or re-routed, the traveler simplifies it (to ~25 m accuracy), encodes it as a polyline string (typically a few KB) and writes it to `routes/{uid}`; the session subscribes to everyone's routes and the map draws each in the traveler's colour beneath your own. Estimated straight lines are never shared. A route is removed when its owner finishes or leaves.
* **Estimated routes** are drawn and labelled as such ("Estimated direct line: turn-by-turn directions are unavailable right now"); they are never presented as real roads.

---

## 9. Place search and routing providers

### Search-as-you-type (`services/places`)

* Providers implement `GeocoderProvider` (`search`, `reverse`). **Geoapify** is tried first; on error, quota exhaustion or a missing key, **LocationIQ** answers. An *empty* result is a valid answer and does not trigger the fallback.
* `TypeAheadController` waits 300 ms after the last keystroke, requires 3+ characters, **cancels the in-flight request** when the text changes and **ignores answers for text you've already changed** (latest wins). Previous results stay visible while the next load.
* Results are cached per (normalised query, location bucket); recent picks are remembered; results are biased toward your location when known.
* The **place picker** screen is reused for the destination and for starting points, with three ways in: search, *Use my current location* (starting points only), and **Pick on map** (a fixed pin over a draggable map with reverse-geocoded address).
* Attribution ("Search by Geoapify and LocationIQ. Map data © OpenStreetMap contributors") is shown, as the free tiers require.

### Routing (`services/routing`)

1. **OpenRouteService** (`driving-car`, `cycling-regular`, `foot-walking`) with real turn-by-turn instructions.
2. Public **OSRM** servers (`routing.openstreetmap.de`, one per profile) as a keyless fallback.
3. A **labelled straight-line estimate** if everything fails, so navigation never hard-fails.

Routes are cached (30 min) and re-routes bypass the cache. The old setup used the OSRM demo server, which is car-only: bike and walking requests silently returned car routes.

---

## 10. Offline behaviour

| Feature | Behaviour |
| :--- | :--- |
| **Connection state** | Firebase's own `.info/connected` drives an "You're offline" banner on the live map. |
| **Your navigation** | Keeps working from GPS and the cached route (stored in SQLite). |
| **Your trip record** | GPS points are written to SQLite as you travel and survive the app being killed; the trip is built from them when you finish. |
| **Publishing** | Skipped while offline; on reconnect the app publishes the **latest** position. Old positions are never replayed (a position is only useful fresh). |
| **Chat** | Messages typed offline are saved in a durable outbox, shown as "Sending…", and delivered on reconnect (or next app start). |
| **Map** | *Offline Map* downloads real MapLibre tiles for your route plus an 8 km margin. Region and zoom are chosen from the actual route and capped at 5,500 tiles (long routes get less street-level detail). Do it on Wi-Fi before you set off. |
| **Friends** | Their last known position stays on the map with a "last seen" time. |

---

## 11. Alerts and notifications

There is **no server push** (that would need Cloud Functions and the paid plan). Instead the phone watches the live data it already receives (`session/journeySession.ts` → `domain/journeyEvents.ts`):

* Someone **joined**, **started**, **arrived**, **finished** or **left**; you became the **host**.
* Someone set their status to **Need Help** (urgent, red, stays longer).
* Someone's **battery is at or below 15%** and not charging (once per dip; re-armed after recovering above 25%).

The first snapshot after opening a journey is not reported (it's just "who is here"). Alerts are shown as an in-app banner while the app is open, and as an Android notification while it's in the background. During a trip the foreground service keeps the app alive, so these still arrive.

---

## 12. Setup guide

### Prerequisites

* Node.js 22+, npm 10+
* Android Studio with SDK platform 34, build-tools 35, NDK 26.1, CMake 3.22 (installed automatically on first build)
* **JDK 17–21 for Gradle.** (Android Studio's bundled JDK 25 breaks this project's Kotlin Gradle plugin; point `JAVA_HOME` at a JDK 17–21.)
* For emulator tests: `npm i -g firebase-tools` and Java 11+
* An Android device with USB debugging, or an emulator

### 1) Install dependencies

```bash
npm install --legacy-peer-deps
```

### 2) Create the Firebase project (free Spark plan)

1. [Firebase Console](https://console.firebase.google.com) → create a project, add an **Android app** with package name `com.syncpoint`, download `google-services.json` into `android/app/` (it is git-ignored).
2. **Build → Authentication → Sign-in method → enable *Anonymous*.**
3. **Build → Realtime Database → Create database.**
4. Deploy the rules:
   ```bash
   firebase login
   firebase use <your-project-id>
   firebase deploy --only database
   ```
   (Or paste `database.rules.json` into the console's *Rules* tab and publish.)

> Deploying the v2 rules makes older builds of the app (which wrote the v1 schema) stop working. Update every phone.

### 3) Create free provider accounts

| Service | Used for | Free allowance | Env variable |
| :--- | :--- | :--- | :--- |
| [Geoapify](https://www.geoapify.com) | Place autocomplete | ~3,000 requests/day | `GEOAPIFY_API_KEY` |
| [LocationIQ](https://locationiq.com) | Autocomplete fallback | ~5,000 requests/day | `LOCATIONIQ_API_KEY` |
| [OpenRouteService](https://openrouteservice.org) | Routing | ~2,000 requests/day | `OPENROUTESERVICE_API_KEY` |

OpenFreeMap tiles and the OSRM fallback need no key.

### 4) Configure `.env`

```bash
cp .env.example .env
```

Fill in the values (every one is documented in `.env.example`):

```
EXPO_PUBLIC_FIREBASE_API_KEY=            EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=        EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_DATABASE_URL=       EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
GEOAPIFY_API_KEY=   LOCATIONIQ_API_KEY=   OPENROUTESERVICE_API_KEY=
INVITE_LINK_BASE_URL=        # e.g. https://syncpoint.example.com (optional until you have a domain)
```

* Values are **inlined into the app at bundle time** (see `babel.config.js`). After editing `.env`, rebuild (or restart Metro with `--reset-cache`).
* `.env` is git-ignored. Each device rations its own daily share of the provider quotas (see §15).
* If Firebase settings are missing, the app shows an "App not configured" screen listing exactly which ones.

### 5) Verify your keys

```bash
npm run check:providers
```

Calls every service live and prints PASS/FAIL with counts (never the keys).

### Invite links (optional, once you have a domain)

Set `INVITE_LINK_BASE_URL=https://your-domain`. The Android manifest picks up the host automatically from `.env` at build time (`android/app/build.gradle`). To make links open the app directly, host an `assetlinks.json` on that domain with your release signing certificate's SHA-256. Without a domain, sharing uses `syncpoint://join/CODE` plus the plain code.

---

## 13. Building and installing

### Debug (needs Metro)

```bash
npm start            # Metro
npm run android      # build, install and run on the connected device
```

### Release APK (JS bundled inside; best for testing on a phone)

```bash
cd android
JAVA_HOME="<path to JDK 17-21>" ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

* First build takes ~10 minutes (native code); JS-only changes ~2 minutes.
* The release APK is about **50 MB**: only the two CPU types real phones use (`arm64-v8a`, `armeabi-v7a`) are packaged, and unused native Firebase libraries are not included. Most of the rest is the map engine and React Native themselves.
* **Signing:** without a keystore the release build is signed with the public debug key and prints a warning. That is fine for testing and sharing with friends. To sign with your own key, provide `SYNCPOINT_KEYSTORE_FILE`, `SYNCPOINT_KEYSTORE_PASSWORD`, `SYNCPOINT_KEY_ALIAS`, `SYNCPOINT_KEY_PASSWORD` as environment variables (never commit the keystore; `*.keystore` is git-ignored). The Gradle build and CI are already wired for this.

### Landing page

```bash
npm run dev          # Vite dev server for index.html / src/web
```

Deployed separately (for example on Vercel).

### CI

`.github/workflows/build-apk.yml` runs type-check, unit tests and the emulator integration tests, then builds a signed release APK from repository secrets (`FIREBASE_*`, provider keys, `GOOGLE_SERVICES_JSON`, `RELEASE_KEYSTORE_*`, `INVITE_LINK_BASE_URL`).

---

## 14. Testing

| Command | What it runs |
| :--- | :--- |
| `npm run typecheck` | TypeScript strict type-check of `src/` and `tests/`. |
| `npm test` | **89 unit tests** (Node test runner via `tsx`) of the real source code: domain rules, route/ETA/arrival maths, participant view-model, providers' response parsing and fallback, quotas, type-ahead (debounce / cancel / latest-wins), SQLite store (real SQLite via `node:sqlite`), tile planning, alerts, history maths, polyline/route sharing, mascots. |
| `npm run test:integration` | **26 tests** against the Firebase **Auth + Database emulators** with the real `database.rules.json` and the production repositories: create/join/lookup, the 10-seat cap and a 4-way race for the last seat, one-active-journey, "friend stays WAITING while the creator travels", illegal state jumps and forged writes rejected, live-data validation, expiry, host hand-off, leave/end/finish, resume after restart, chat rules, shared-route and mascot rules. Requires `firebase-tools` and Java. |
| `npm run check:providers` | Live smoke test of Geoapify, LocationIQ, OpenRouteService and OSRM with your `.env` keys. |

On-device behaviour (GPS, background tracking, battery, offline map download, two-phone flows) cannot be proven by automated tests; use the checklist below.

### Two-phone test checklist

0. In **Profile**, make your mascot (animal + colour) and save.
1. Create a journey with a searched destination (suggestions should appear as you type); join from the second phone.
2. Press **Start on one phone only**: the other must show **"Not started"**, never "arrived". Compare each phone's reported battery with its real battery.
3. Press Home and lock the screen for ~2 minutes with sharing on: the other phone's "last seen" must keep refreshing.
4. **Pause**: the friend sees "Paused · last seen…", your own navigation continues. Resume.
5. Travel toward the destination: distance shrinks *along the road*; at the destination you get the arrival prompt and the friend sees "Arrived".
6. **Offline Map**: download on Wi-Fi, switch to airplane mode, confirm the map still draws.
7. In airplane mode send a chat message ("Sending…"), reconnect, it arrives.
8. Set status to **Need Help**: the friend gets a red alert.
   Check that you see each other's **mascot** on the map and each other's **route line** in their own colour.
9. Kill the app mid-journey and reopen: it returns to the journey and GPS restarts.
10. Press the host's **Leave**: the longest-standing member becomes host.

---

## 15. Staying within the free tiers

| Resource | Free limit | How the app stays inside it |
| :--- | :--- | :--- |
| Firebase RTDB | 1 GB stored, 10 GB/month download, **100 simultaneous connections** | Only the *latest* position and one compact route per traveler are stored (not a log); publishing is adaptive (25 s when stationary); 10-person cap; history is local-only. 100 connections comfortably covers ~50 testers. |
| Geoapify / LocationIQ / ORS | ~3k / ~5k / ~2k requests per day (shared by everyone using the key) | `QuotaGuard` caps each *device* per day (2,400 / 4,000 / 1,200); queries are debounced, cancelled, cached; routes are cached; automatic fallback between providers. |
| OpenFreeMap tiles | Free, no key | Offline downloads are limited to your route corridor. |
| Cloud Functions / FCM | Need the paid plan | Not used: security is in the rules, alerts are local. |

Tunable in `src/constants/config.ts` (`DAILY_QUOTA`, sampling intervals, radii, `MAX_MEMBERS`).

---

## 16. Troubleshooting and gotchas

* **"App not configured" screen**: some `EXPO_PUBLIC_FIREBASE_*` values are missing from `.env`; rebuild after fixing.
* **Everything fails with *permission denied***: the v2 rules aren't deployed (or an old app build is installed), or Anonymous sign-in isn't enabled.
* **Gradle error "25.0.3" / Kotlin script failure**: Gradle is running on JDK 25; set `JAVA_HOME` to JDK 17–21.
* **`react-native-screens` won't compile**: it must stay at **4.10.0** for React Native 0.78.
* **Search says unavailable**: keys missing, daily share used up, or offline. The map-pin option always works. Run `npm run check:providers`.
* **Emulator tests: "port 9000 taken"**: a previous emulator is still running; stop its Java process.
* **Hermes/React Native lacks some web APIs** (for example `URLSearchParams.set` throws on device while Node accepts it). Use `src/utils/queryString.ts` for URLs and test new web-API usage on a real device.
* **Env changes not picked up**: values are inlined at bundle time; rebuild or `npm start -- --reset-cache`.
* **Location permission denied**: the app explains and offers to open Settings; a banner on the map appears if sharing is off while you're travelling.
* **Battery optimisation (some OEMs)**: aggressive vendors can kill background apps; exempt SyncPoint from battery optimisation for long trips.

---

## 17. Documentation index

* [`docs/architecture.md`](docs/architecture.md): system overview, state machines, layers, offline/alerts design.
* [`docs/firebase-rules.md`](docs/firebase-rules.md): full schema, who-can-do-what table, how the free-plan guarantees work, deployment.
* [`docs/developer_handoff.md`](docs/developer_handoff.md): the original v1 product definition and decisions (historical; the app has since moved to the architecture described here).
* [`.env.example`](.env.example): every configuration value, documented.
