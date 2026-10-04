# SyncPoint (Shared Journey) • Android V1

> **"We are all traveling somewhere together. Put everyone on one map."**

SyncPoint is a temporary, journey-centered Android mobile application built for groups of friends traveling to the same destination from different starting points.

---

## Key Highlights

- **One Destination, Independent Origins**: A common destination is chosen by the creator; each traveler selects an independent starting point and travel mode (**Car**, **Bike**, **Walking**).
- **Frictionless Onboarding**: No account creation, phone OTP, or password. Uses **Firebase Anonymous Authentication** behind the scenes to maintain unique, secure UIDs for database security rules.
- **Android Background Location Reliability**: Powered by a custom **Native Kotlin Foreground Service** (`JourneyLocationService`) running under Android 14+ `FOREGROUND_SERVICE_TYPE_LOCATION`, with an **Adaptive Sampling Engine** (2.5s for fast highway movement to 20-30s stationary heartbeat) and persistent notification drawer controls.
- **Mutual Visibility & Live Map**: Built with **MapLibre React Native**, displaying the user's primary route, subordinate participant routes, live speed, remaining distance, ETA, battery percentage, last-updated recency, and current road.
- **Offline Resilience**: Supports explicit offline map downloads via MapLibre's `OfflineManager`, cached route continuation, and local SQLite segment buffering when network connectivity drops.
- **Live State vs. History**: Live sharing is strictly temporary (active only while moving, pausing, or until creator-selected journey expiry). Completed journeys and compressed route polylines are retained **indefinitely** for history replay.
- **Group Coordination**: Group text chat, quick travel status chips (e.g., *Fuel Stop*, *Food Stop*, *Break*, *Need Help*), direct native phone dialer integration, and an emergency action sheet.

---

## Getting started

```bash
npm install --legacy-peer-deps
cp .env.example .env        # then fill in the Firebase + provider keys (see comments inside)
npm run typecheck && npm test
npm run test:integration    # security rules + journey flows against the local Firebase emulator (needs firebase-tools + Java)
npm start                   # Metro
npm run android             # build & run on a device (JDK 17-21 for Gradle)
```

Firebase setup (free Spark plan, no Cloud Functions): create a Realtime Database, enable
**Anonymous** sign-in, then `firebase deploy --only database`. Details in `docs/firebase-rules.md`.

## Project layout

```
src/
  app/            navigation (React Navigation), bootstrap
  features/       screens: home, profile, journey (create, join, lobby, active, chat, history)
  session/        live journey session + user-facing actions
  data/           Realtime Database repositories, schema paths, serialization, server clock
  domain/         pure rules: traveler state machine, seats, join codes, invite links
  services/       firebase client/auth, location bridge, routing, offline maps
  store/          Zustand mirrors of session/profile state
  config/         typed environment
android/          Gradle project + Kotlin foreground location service
tests/unit        pure-logic tests;  tests/integration  rules + flows against the Firebase emulator
docs/             architecture + security rules
index.html, src/web   landing page (Vite) - deployed separately
```

---

## Development Phases

1. **Phase 0**: Technical Foundation & Scaffolding *(Current)*
2. **Phase 1**: Core Shell & Journey Management
3. **Phase 2**: Live Group Map Surface
4. **Phase 3**: Android Native Location Foreground Service
5. **Phase 4**: Routing, Maneuvers & Navigation
6. **Phase 5**: Offline Maps & Sync Resilience
7. **Phase 6**: Coordination & Safety
8. **Phase 7**: History Retention & Security Hardening
9. **Phase 8**: Multi-Traveler Testing & Verification
