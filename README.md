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

## Monorepo Architecture

```
/s/SyncPoint
├── src/                # React Native app source (TypeScript)
│   ├── app/            # Navigation stacks, providers, app entry
│   ├── features/       # auth, profile, home, journey (create, join, lobby, active, history, chat)
│   ├── components/     # Map components, bottom sheet, traveler cards, status chips
│   ├── services/       # Firebase RTDB & Auth, OSRM routing, FCM, native location bridge
│   ├── store/          # Zustand stores (journey, profile, navigation, liveLocation)
│   ├── db/             # SQLite local offline cache
│   ├── constants/      # App config & adaptive sampling thresholds
│   ├── types/          # Domain schemas & TypeScript definitions
│   └── utils/          # Geodesic math, time formatting, battery monitor
├── android/            # Android native Gradle project & Kotlin location module
│   └── app/src/main/java/com/syncpoint/location/
│       ├── JourneyLocationService.kt
│       ├── LocationEngine.kt
│       ├── AdaptiveSamplingPolicy.kt
│       ├── NotificationController.kt
│       └── LocationBridgeModule.kt
├── functions/          # Firebase Cloud Functions (trusted server-side lifecycle)
├── routing/            # OSRM routing configurations & profile definitions
├── docs/               # Developer handoff specifications & architecture documentation
└── tests/              # Multi-traveler simulation harness & unit tests
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
