SHARED JOURNEY
Android V1 Developer Handoff
Live group travel tracking + navigation for friends on road trips


| Document | Status |
| Product definition | LOCKED |
| Target platform | Android first; React Native codebase |
| Maximum journey size | 10 travelers including creator |
| Audience | Friends traveling together / road trips |
| Pricing | Free to users |
| Primary UX | Simple, familiar, Google Maps-like |
| Core backend | Firebase Realtime Database + minimal server-side functions |
| Map renderer | MapLibre React Native |
| Routing | Self-hosted OSRM / equivalent routing service |


Prepared from product decisions finalized in this conversation, with current platform/documentation verification performed on October 3, 2026.

1. Executive Summary
Shared Journey is a temporary, journey-centered mobile application for groups of friends traveling to the same destination from different starting points. Any person can create a journey, set one shared destination, invite up to nine other travelers, and let every traveler select an independent origin and travel mode. Once an individual presses Start Journey, their device begins live location tracking. Every active participant can see the other participants on a shared map, together with navigation, route, ETA, distance, speed, battery, last-updated time, current road, phone/call access, chat, and lightweight travel statuses.
The product is intentionally not a permanent family tracking network or social feed. The primary mental model is Journey: create a trip, gather the travelers, navigate to one common destination, coordinate while moving, arrive, and finish. Location sharing is available only inside an active journey, and the creator chooses the journey expiry. Completed journeys and their route history are retained indefinitely.
Core product statement: “We are all traveling somewhere together. Put everyone on one map.”
2. Product Principles and Non-Goals
2.1 Principles
Map first. The active journey map is the primary product surface.
Journey, not tracking, is the mental model. Users start a journey rather than permanently sharing location.
One destination, many origins. The destination is common to the group; each traveler controls their own starting point.
Simple onboarding. No traditional login or registration flow is required.
Temporary by default. Live sharing stops when the traveler finishes, the journey is ended, or the creator-selected expiry is reached.
Offline-aware. Users can explicitly download map data and continue on a cached route when connectivity is lost.
Battery-aware. Location updates adapt to movement instead of running at maximum frequency continuously.
Mutual visibility. Every active participant can see the other active participants on the same live map.
Privacy is scoped to the journey. A participant is visible to journey members only during the active sharing window.
2.2 Explicit non-goals for V1
Permanent family circles or always-on location sharing outside journeys.
Social feed, follower graph, public profiles, or public travel posts.
Marketplace, hotel/flight booking, trip planning content, or travel recommendations.
Gamification or leaderboards.
Support for more than 10 travelers in one journey.
iOS production release in V1 (the codebase remains React Native to support iOS later).
Guaranteed fully offline route recalculation. V1 supports offline map packs and cached route continuation; true offline rerouting is a later engineering track.
User billing, subscriptions, or ads. The app is free to users in V1.
3. Locked Product Decisions
| Decision | Final choice |
| Journey creation | Anyone can create a journey. |
| Journey owner | The creator is the journey owner/admin. |
| Destination | Creator selects one destination shared by all participants. Participants cannot replace the destination. |
| Origin | Each traveler selects their own starting point; it can be current location or a searched place. |
| Start | Each traveler begins location sharing only after pressing Start Journey. |
| Start timing | Creator may start their own journey while other invitees are still in the lobby. |
| End | Traveler sees “You've arrived” and must press Finish. Creator can also end the whole journey. The creator-selected expiry automatically ends the journey when reached. |
| Active journeys | A user may have only one active journey at a time. |
| Journey size | Maximum 10 travelers, including creator. |
| Travel modes | Car, Bike, Walking. Traveler selects their mode. |
| Join methods | One-tap invite link, QR code, and short journey code. |
| Accounts | No login/signup flow. Anonymous backend identity is used behind the scenes. |
| Profile | Name, photo, phone, username. |
| Phone visibility | Journey members can directly see a participant’s phone number and call them. |
| Live data | Other members see location, ETA, distance, speed, travel mode, battery, last-updated time, current road, expected arrival time, and route. |
| Pause | Traveler can pause sharing temporarily. Last known location remains visible with a paused state. |
| Removal/leave | Creator can remove members. Members can leave the journey. |
| Privacy | Location is visible only during the active journey. Raw location history is retained for completed journeys as specified by the product. |
| History | Completed journeys are stored indefinitely. |
| Offline | Offline map download is an explicit user action. |
| Notifications | Push notifications are part of V1. |
| Chat | Group chat is part of V1. |
| Quick statuses | Travel status shortcuts are part of V1. |
| Emergency | Basic emergency actions are part of V1. |
| Platform | Android first; React Native. |
| Audience | Friends going on road trips. |
| Target validation scale | Approximately 50 users initially. |
| Pricing | Completely free to users. |


4. Personas and Primary Use Case
4.1 Primary persona
A friend traveling to a common destination with other friends, often from different cities. They do not want to share their location permanently, do not want a complicated account setup, and need a single view showing who is where and when everyone is expected to arrive.
4.2 Canonical scenario
Delhi        Gwalior        Jaipur        Mumbai   \           |             /             /    \          |            /             /     +----------+-----------+-------------+                    |                    v                Goa AirportOne journeyOne destinationIndependent originsIndependent start timesIndependent travel modes
The group creates “Goa Trip”, selects Goa Airport as the destination, shares the invite link, and each participant sets their own origin. The creator starts immediately; other travelers can begin later. The map updates continuously while each person is active.
5. End-to-End User Flows
5.1 First launch / lightweight identity
App launch  -> initialize local device identity  -> sign in anonymously to Firebase  -> if no local profile: create profile  -> Home
No phone OTP, Google login, password, or traditional signup is shown in V1. The backend still uses an anonymous Firebase user so Realtime Database Security Rules can distinguish participants and restrict access. Firebase documents anonymous authentication as a way to let users work with rule-protected data without first creating an account. [5]
5.2 Create journey
Tap Create Journey.
Enter journey name.
Search/select shared destination.
Choose journey expiry. The creator controls the expiry timestamp/duration.
Create journey.
Show invite link, QR code, and short journey code.
Show lobby with member list and journey destination.
Allow creator to start their own trip even when some invited members are still in the lobby.
5.3 Join journey
Open invite link, scan QR, or enter journey code.
Show journey name and shared destination before join confirmation.
Collect/confirm profile information: name, username, photo, phone.
Explicitly tell the user that their phone number is visible to other journey members.
Choose origin: Use Current Location or Search for Place.
Choose travel mode: Car, Bike, Walking.
Enter journey lobby.
5.4 Start journey
Validate one active journey restriction.
Validate location permission and device location services.
Start Android location foreground service while the app is visible.
Create/activate the participant live-state record.
Calculate or load route from origin to shared destination for the chosen travel mode.
Begin adaptive location sampling and live-state publishing.
Start navigation camera behavior when navigation mode is active.
5.5 Active journey
Active Journey  |  +-- own location  +-- other members' live locations  +-- shared destination  +-- own route  +-- other routes (overview)  +-- navigation instructions  +-- traveler cards  +-- chat  +-- quick statuses  +-- phone/call  +-- pause sharing  +-- emergency  +-- end/finish  +-- journey expiry watcher
5.6 Arrival and finish
When geofence/proximity logic determines the traveler is at the destination, show “You've arrived”.
Do not silently stop tracking at arrival. Continue sharing until the traveler presses Finish, subject to expiry.
After Finish: stop location service, mark participant as arrived/finished, and remove live location publication.
Keep final route/history on the completed journey.
If everyone finishes, the journey can be automatically transitioned to completed; creator can also end the whole journey earlier.
5.7 Expiry
The creator chooses the expiry. The system must always have a hard stop for live tracking. When expiry is reached, the journey transitions to expired and live sharing is disabled for all members. Any client that is offline at expiry must converge to the expired state when connectivity returns; the server timestamp is authoritative.
6. UX / UI Specification
6.1 Visual direction
Familiar Google Maps-like information hierarchy without copying proprietary visual assets or styling.
Map occupies most of the screen on the active journey.
Bottom sheets for traveler lists, details, quick actions, and chat.
Large readable ETA and next-navigation instruction.
Minimal chrome; controls float over the map.
The user’s own route is visually primary. Other participant routes are subordinate and become more visible when zoomed out.
Avoid exposing GPS accuracy numbers to the user in the normal UI.
6.2 Screen inventory
| # | Screen | Purpose |
| 1 | Launch / bootstrap | Anonymous auth, local profile check, service initialization. |
| 2 | Home | Active journey card, recent history, Create Journey. |
| 3 | Create Journey | Name, destination, expiry. |
| 4 | Destination Search | Search/place selection and confirmation. |
| 5 | Journey Lobby / Invite | Members, destination, invite link, QR, code, creator actions. |
| 6 | Join / Profile | Profile fields and phone visibility consent. |
| 7 | Origin + Travel Mode | Select start point and Car/Bike/Walking. |
| 8 | Active Journey Map | Map, navigation, members, routes, controls. |
| 9 | Traveler Details | All requested live stats, route, call, navigate, chat. |
| 10 | Chat | Group text + quick statuses. |
| 11 | Settings / Journey Controls | Pause, leave, end, expiry, member management. |
| 12 | Journey Summary / History | Route replay, traveler summary, timestamps, distance, duration. |


6.3 Home
+--------------------------------------+| Shared Journey                       ||                                      || ACTIVE JOURNEY                       || Goa Trip                             || Goa Airport                          || 4/7 travelers active                 || [ Open Journey ]                     ||                                      || RECENT                               || Jaipur Trip   26 Sep                 || Udaipur Trip  11 Aug                 ||                                      ||          [ + Create Journey ]        |+--------------------------------------+
6.4 Active journey map
+--------------------------------------+| < Goa Trip                     ...   ||                                      ||           NEXT                       ||       Turn left in 300 m             ||                                      ||             Map                      ||       o        o                     ||          \  /                       ||           \/                        ||           o-------> Destination      ||                                      ||   [recenter]                         ||                                      ||--------------------------------------|| Shashank     2h 14m    142 km        || Rahul        1h 42m     88 km        || Priya        3h 02m    198 km        || Amit         Arrived                 |+--------------------------------------+
6.5 Traveler card
| Field | Behavior |
| Name / avatar | Display profile name and photo/initial. |
| Origin -> destination | Show selected origin and common destination. |
| Travel mode | Car, Bike, Walking. |
| Distance remaining | Route distance from current matched position to destination. |
| ETA | Expected arrival time based on current route estimate plus progress. |
| Speed | Current speed when moving; show “Stopped” when below motion threshold. |
| Battery | Latest battery percentage when available. |
| Last updated | Human-readable recency, e.g. “6 sec ago”. |
| Current road | Road name from route/map matching when available. |
| Phone | Visible to journey members; tap Call to open native call UI. |
| Navigate to traveler | Optional action to route the user toward the traveler location. |
| Chat | Open group chat or a quick message composer. |
| Share route | Share this traveler’s route summary/link within the journey. |


7. Technical Architecture
7.1 Architecture decision
Use a minimal cloud backend rather than device-to-device location synchronization. The devices may still communicate locally in future, but V1 must not depend on proximity. Nearby Connections is designed for nearby discovery and peer-to-peer exchange, while internet-wide P2P introduces signaling and fallback complexity. [11]
React Native (TypeScript)        |        +---------------- UI / Navigation / Journey state        |        +---------------- MapLibre map renderer        |        +---------------- Local SQLite cache        |        +---------------- Native Android location module (Kotlin)        |        +---------------- FCM client        |        vFirebase  |-- Anonymous Auth  |-- Realtime Database  |-- App Check / Play Integrity  |-- Cloud Functions (minimal, server-side events)        |        +---------------- OSRM routing service        |        +---------------- Map tile provider / self-hosted tiles
7.2 Why Firebase Realtime Database
Realtime Database is a natural fit for the live-state portion of this product because data is synchronized to connected clients, can remain available locally while a device is offline, and is governed by Firebase Security Rules. [4]
The database should be used as a shared state bus, not as an unbounded GPS event log. The current live location is stored at one stable path per participant. Historical samples are batched/compressed locally and periodically persisted to journey history.
7.3 Why anonymous Firebase auth
The visible UX remains “no login.” Internally, every installation gets an anonymous Firebase UID. This gives Security Rules a stable principal and avoids public read/write access. Firebase supports temporary anonymous accounts for accessing rule-protected data without requiring a traditional sign-in first. [5]
7.4 Why MapLibre
MapLibre React Native is selected because V1 explicitly requires offline map packs. Its OfflineManager supports creating offline packs for geographic regions. [9] The visual layer must be styled to feel familiar and simple; do not copy Google proprietary map assets.
7.5 Why OSRM
OSRM exposes route, step, and map-matching services and supports transport profiles that can represent car, bike, and foot routing. Route responses can include distance, duration, geometry, and turn-by-turn steps. [10]
The public OSRM demo server must not be treated as the production backend. V1 should use a self-hosted routing instance or a properly licensed routing provider. This keeps the app architecture independent of one public endpoint and allows request throttling, monitoring, and predictable behavior.
8. Native Android Location System
8.1 Required design
Location tracking is implemented as a small native Kotlin subsystem exposed to React Native. React Native owns product state and UI; Kotlin owns the long-running location lifecycle.
React Native    | startTracking(config)    vKotlin TrackingService    |    +-- Fused Location Provider / LocationManager    +-- activity + speed + heading extraction    +-- adaptive sampling policy    +-- local event buffer    +-- persistent notification    +-- foreground service lifecycle    |    +-- emits normalized location events to JS    +-- writes durable buffer to local DB
8.2 Android foreground service requirements
The app must start the location foreground service from a visible UI action (Start Journey). Current Android guidance requires a declared foreground-service type of location for long-running location use and, for apps targeting Android 14/API 34 or higher, the corresponding foreground-service permission and runtime prerequisites. Android also restricts starting foreground services from the background. [2][3]
Implementation rule: do not wait until the app has already moved to the background before starting tracking. Start the service directly from the Start Journey action while the activity is visible, then allow the service to continue after screen lock/backgrounding.
8.3 Location permissions
Request foreground location before starting the trip and explain that it is required to show the traveler on the group map and provide navigation. Do not request more permissions than necessary. Android distinguishes foreground and background location and requires careful handling of the permission flow. [1]
Engineering note: the final permission matrix must be revalidated against the exact target SDK and Google Play policy requirements at release time. Avoid requesting ACCESS_BACKGROUND_LOCATION unless the final implementation genuinely requires it; the foreground-service model should be the default V1 path.
8.4 Adaptive location sampling
| State | Target sampling | Broadcast policy |
| Fast movement | 2-3 sec | Broadcast on interval + meaningful distance/heading change. |
| Normal movement | 5 sec | Default road travel cadence. |
| Slow movement | 8-10 sec | Reduce frequency when movement is low. |
| Stationary | 20-30 sec | Keep a heartbeat; publish only meaningful changes. |
| Extended stationary | Low frequency | Keep alive and preserve status; do not stream redundant coordinates. |


These are starting values, not absolute contracts. The location engine should use both time and distance thresholds, e.g. publish only when enough time has passed OR the device has moved beyond a configurable threshold. Tune using real device telemetry and battery tests.
8.5 Stale location behavior
If the device stops publishing, preserve its last known location in the shared map.
Show a last-updated timestamp and a non-technical status such as “Last seen 2 min ago”.
Do not fabricate an updated position when the device is disconnected.
When the connection returns, publish the freshest location and synchronize the participant state.
9. Realtime Data Model
9.1 Top-level Firebase Realtime Database layout
/users/{uid}  profile  device  preferences/journeys/{journeyId}  meta  destination  members/{uid}  live/{uid}  routes/{uid}  history/{uid}/segments/{segmentId}  chat/{messageId}  statuses/{statusId}  events/{eventId}/joinCodes/{code}  journeyId  expiresAt  status/activeJourneyByUser/{uid}  journeyId  startedAt  expiresAt
9.2 Journey meta schema
| Field | Type | Rules |
| journeyId | string | Opaque UUID/ULID; never sequential. |
| name | string | 1-80 chars. |
| status | enum | LOBBY | ACTIVE | COMPLETED | EXPIRED | CANCELLED. |
| creatorUid | string | Immutable after creation. |
| createdAt | server timestamp | Server authoritative. |
| startedAt | timestamp|null | Journey-level start can be recorded when creator first starts. |
| expiresAt | timestamp | Required; selected by creator. |
| destination | object | lat, lng, placeId/lookupKey, displayName, address. |
| memberCount | integer | Max 10; server-validated. |


9.3 Member schema
| Field | Example / meaning |
| uid | Anonymous Firebase UID. |
| name | Display name. |
| username | Human-readable handle; unique enough for a journey UI, not a public identity system. |
| phone | Phone number visible to journey members. |
| photo | Small compressed avatar representation or future object-storage reference. |
| role | CREATOR or MEMBER. |
| origin | Selected start coordinate + label. |
| travelMode | CAR | BIKE | WALK. |
| sharingState | NOT_STARTED | ACTIVE | PAUSED | ARRIVED | FINISHED | LEFT. |
| joinedAt | Timestamp. |
| startedAt | Timestamp when participant presses Start Journey. |
| finishedAt | Timestamp when participant presses Finish. |


9.4 Live location schema
{  "lat": 25.4358,  "lng": 81.8463,  "heading": 178.2,  "speedMps": 18.4,  "batteryPct": 67,  "status": "ON_THE_WAY",  "lastUpdatedAt": 1791000000000,  "currentRoad": "NH 44",  "distanceRemainingM": 142300,  "etaEpochMs": 1791008520000,  "routeVersion": 3,  "isSharing": true}
9.5 Route schema
Persist the currently active route separately from live location. A route record should contain route version, selected profile, origin, destination, route geometry, legs, steps, total distance, total duration, and generated timestamp. A route version increments whenever the traveler is rerouted.
10. Realtime Protocol and Update Strategy
10.1 Publish current state, not every raw sample
The client can sample GPS more frequently than it publishes to Firebase. For example, the native location engine may receive several location fixes while only the latest meaningful fix is written to the live node. This keeps Firebase bandwidth and battery use under control.
GPS fix  -> validate timestamp  -> reject impossible jumps  -> snap/match to route where useful  -> calculate speed / heading / progress  -> update local state  -> shouldPublish()?       | yes -> Firebase /journeys/{id}/live/{uid}       | no  -> keep locally
10.2 Recommended publish conditions
Time since last publish >= adaptive interval.
Moved >= configured minimum distance threshold.
Heading change exceeds configured threshold while moving.
Navigation step transition occurred.
Arrival state changed.
Pause/resume/finish/status event occurred.
Connection restored after offline period.
10.3 Conflict rule
The participant device owns its live location fields, but server-side journey state is authoritative for membership, active/expired status, creator permissions, and expiry. A stale client must never be able to revive an expired journey by writing a live location.
11. Navigation and Routing
11.1 Route creation
origin + destination + travelMode             |             v        Routing API             |      +------+-------+      |              |  geometry         steps      |              |      v              v polyline        maneuvers      |              |      +------+-------+             v      JourneyNavigationState
Use a routing API with separate profiles for car, bike, and foot. OSRM’s route service returns geometry, distance, duration, legs, and turn-by-turn steps; its map-matching service can match GPS traces to the road network. [10]
11.2 Navigation UI
Top banner: next maneuver and distance to maneuver.
Map camera follows the user’s own route during navigation.
Destination remains identifiable and reachable from overview mode.
Bottom information area: ETA, remaining distance, arrival time.
Recenter button returns the camera to the user’s current navigation position.
Voice guidance through Android Text-to-Speech in V1.
Off-route detection triggers route recalculation when connectivity is available.
Other users’ routes remain visible in overview mode and can be de-emphasized during focused navigation.
11.3 Navigation to another traveler
Selecting Navigate to a traveler uses the traveler’s current last-known location as the temporary destination for the current user. This is a secondary route and must not mutate the journey’s canonical shared destination. When the user exits that temporary route, the app returns to the original journey route.
11.4 Offline navigation scope
The app must support an explicit offline map download. MapLibre’s OfflineManager can create offline packs for a geographic region. [9] For V1, download the user’s route corridor or a destination region plus a safety margin, and cache the route geometry and turn steps. If connectivity disappears, GPS and the cached route can continue to work. However, a fully offline reroute engine is not included unless a later local routing component is added.
This is intentional. Google’s Navigation SDK currently documents no offline mode, although it can pre-cache journey information, which is one reason it is not the V1 navigation dependency. [8]
12. Offline-First Behavior
| Feature | Online | Offline |
| Own GPS | Live | Live from device sensors. |
| Own navigation | Live route + reroute | Continue cached route and instructions; no guaranteed fresh reroute. |
| Map | Live tile loading | Use downloaded offline map pack. |
| Other travelers | Realtime | Show last known location and recency. |
| Chat | Send/receive | Queue outgoing messages locally; send after reconnect. |
| Journey status | Realtime | Local UI continues, server state converges on reconnect. |
| History | Persist | Buffer local segments; sync when online. |
| Finish | Persist immediately | Persist locally; sync on reconnect. Expiry remains server-authoritative. |


12.1 Explicit offline map flow
Open journey route overview or navigation settings.
Tap Download Offline Map.
Show estimated storage size and selected geographic region.
Download via MapLibre OfflineManager.
Persist pack ID and metadata locally.
Expose progress and completion state.
Allow user to delete the downloaded region later.
13. Journey History and Storage
Completed journeys are stored indefinitely. Because raw high-frequency GPS samples can become expensive and bulky, history should be represented as compressed route segments rather than every sensor fix. The client can retain raw temporary samples for map matching, then simplify and upload a lower-density polyline with timestamps.
Local raw samples   -> filter noise   -> simplify polyline   -> split into time/distance segments   -> sync segment   -> server stores immutable journey historyHistory viewer   -> route polyline   -> traveler selection   -> timestamps   -> distance/duration summary
Product rule: “indefinite” means the backend does not automatically delete completed journey records in V1. A future data-retention/privacy feature can add user-controlled deletion without changing the active tracking architecture.
14. Chat, Statuses, and Emergency
14.1 Group chat
Keep chat intentionally simple: plain text messages, timestamps, sender name, and quick-status buttons. It is a journey coordination tool, not a standalone messaging product.
14.2 Quick statuses
| Status | Meaning / UI behavior |
| On the way | Default active state. |
| Fuel stop | Temporary status card on participant. |
| Food stop | Temporary status card. |
| Break | Temporary status card. |
| Restroom | Temporary status card. |
| Stopped | Participant is stationary; can also be inferred. |
| Traffic | Manual declaration. |
| Vehicle problem | Manual alert. |
| Need help | Escalated status and emergency action sheet. |
| Back on route | Return to normal state. |


14.3 Emergency action sheet
Need Help?Current location[ Share Location ][ Call Traveler ][ Call Emergency Services ][ Cancel ]
The emergency feature is intentionally lightweight. It must not be presented as a replacement for emergency services or as a guaranteed safety system.
15. Notifications
Use Firebase Cloud Messaging for push notifications. FCM supports background notification delivery on Android and is the natural messaging layer for journey events. [7]
| Event | Recipients | Priority / behavior |
| Someone joined | Creator + active members | Normal. |
| Someone started | Journey members | Normal. |
| Someone arrived | Journey members | Normal/high based on user-visible urgency. |
| Someone left | Journey members | Normal. |
| Journey expiry warning | Active members | High only when near expiry and user action is needed. |
| Journey expired | All members | Normal. |
| Emergency status | Journey members / creator | High, with strong user-facing action. |
| Chat message | Members as appropriate | Normal. |
| Low battery | Optional journey members | Normal; can be throttled. |


Use server-side functions only for events that require trusted fan-out or privileged operations. Firebase Cloud Functions currently require the Blaze plan, so this is an operational cost consideration even though the end-user app remains free. [12][13]
16. Security and Privacy Model
16.1 Security goals
A user who does not belong to a journey must not read its member/live/history data.
Only the creator can remove members or end the journey for everyone.
A participant can write only their own live state and own profile-owned fields.
Participants cannot overwrite the shared destination after creation.
An expired/completed journey cannot accept new live location writes.
Join codes are opaque and short-lived enough to reduce accidental exposure.
Phone numbers are never exposed outside the journey membership boundary.
Client-side role checks are for UX only; Security Rules and server-side validation enforce authorization.
16.2 App Check
Enable Firebase App Check with the Play Integrity provider for the Android production app. Firebase documents App Check as a way to help ensure that only the legitimate app can access protected Firebase resources. [6] Start in monitoring mode, validate legitimate traffic, then enforce it.
16.3 Join code security
The displayed short code is a convenience, not a secret strong enough by itself. Use it as a discovery key with server-side rate limiting. The invite link should carry a longer opaque invite token. QR code and link can point to the same invite record.
16.4 Phone visibility
Because phone numbers are directly visible to journey members, the join/profile screen must clearly state that the number will be visible to everyone in the journey. Do not index phone numbers publicly. Call actions should launch the native dialer rather than implementing in-app voice calling.
16.5 Anonymous identity limitation
No-login UX creates a product trade-off: anonymous identities are convenient but not inherently recoverable after app data is cleared or the app is reinstalled. V1 should document this limitation. The server can keep the journey history indefinitely, but the user may not be able to reclaim the same anonymous identity after data loss. A future recovery mechanism can be added without converting the normal onboarding experience into a full login flow.
17. Firebase Security Rules - Logical Requirements
The following is a logical specification; exact Firebase Security Rules syntax should be implemented and tested as part of the repository.
| Path | Read | Write |
| /users/{uid} | Authenticated same uid; limited profile visibility where needed. | Authenticated same uid. |
| /journeys/{id}/meta | Journey members only. | Creator only for editable fields; server-controlled status timestamps. |
| /journeys/{id}/destination | Journey members. | Create-time only; creator; immutable after creation. |
| /journeys/{id}/members | Journey members. | Self join/update; creator can remove/update member administration fields. |
| /journeys/{id}/live/{uid} | Journey members. | Only same uid; only while journey active; not after expiry. |
| /journeys/{id}/routes/{uid} | Journey members. | Only same uid for own route, subject to active/completed state. |
| /journeys/{id}/history | Journey members / authorized viewer. | Participant can append own history while active; immutable after completion where possible. |
| /journeys/{id}/chat | Journey members. | Journey members can create messages; cannot edit others. |
| /joinCodes/{code} | Server/controlled lookup path only. | Server-controlled. |
| /activeJourneyByUser/{uid} | Same uid / server validation. | Server-controlled or transactionally validated. |


Important: Firebase rules are not relational constraints. Use atomic multi-location writes and/or trusted server functions for the “one active journey per user”, maximum member count, join-code consumption, creator-only actions, and expiry transitions.
18. Server-Side Functions
Keep the server layer intentionally small. The mobile client can directly use Firebase Realtime Database for normal member/live-state operations, while trusted functions handle operations that should not be forgeable from an untrusted client.
| Function | Purpose |
| createJourney | Generate journey ID, join token/code, validate expiry, create creator membership, reserve active state where applicable. |
| joinJourney | Validate invite/code, enforce max 10, create membership, prevent unauthorized joining. |
| startParticipant | Validate active-journey constraint, atomically reserve /activeJourneyByUser, mark member started. |
| finishParticipant | Finalize participant status and release active journey reservation. |
| endJourney | Creator-only journey-wide end, stop all future live writes. |
| expireJourney | Scheduled/authoritative expiry transition; disables live sharing. |
| pushJourneyEvent | Fan-out FCM notifications for join/start/arrival/emergency/etc. |


Because scheduled/background server functions can require Blaze billing, monitor them and set budget alerts. Firebase currently documents Cloud Functions as available through the Blaze plan. [12][13]
19. React Native Project Structure
src/  app/    navigation/    providers/  features/    auth/    profile/    home/    journey/      create/      join/      lobby/      active/      history/      chat/  components/    map/    bottomSheet/    travelerCard/    buttons/    statusChips/  services/    firebase/    routing/    notifications/    location/    offlineMaps/    phone/  store/    journeyStore/    profileStore/    navigationStore/  db/    sqlite/  utils/  types/android/app/src/main/java/.../location/  JourneyLocationService.kt  LocationEngine.kt  AdaptiveSamplingPolicy.kt  LocationBridgeModule.kt  NotificationController.kt
19.1 State management
Use a small predictable client state layer such as Zustand. Do not mirror the entire Firebase database into React state. Separate: authenticated user/profile state, current journey metadata, live participant state, own navigation state, and transient UI state.
19.2 Repository boundaries
JourneyRepository: create/join/read/update journey metadata.
LiveLocationRepository: publish/read participant live state.
RouteRepository: request/cache routes and route versions.
HistoryRepository: persist compressed segments locally and sync them.
OfflineMapRepository: manage MapLibre offline packs.
NotificationRepository: register FCM token and process journey events.
ProfileRepository: store profile metadata and compressed avatar.
20. Core APIs / Interfaces
20.1 Mobile service interfaces
JourneyService- createJourney(input)- joinJourney(inviteToken)- leaveJourney(journeyId)- endJourney(journeyId)- getCurrentJourney()LocationService- preparePermissions()- startTracking(config)- pauseTracking()- resumeTracking()- finishTracking()- getTrackingState()RoutingService- getRoute(origin, destination, mode)- reroute(currentLocation, destination, mode)- matchTrack(points, mode)OfflineMapService- downloadRegion(region)- getDownloadState(id)- deleteRegion(id)ChatService- sendMessage(journeyId, text)- observeMessages(journeyId)NotificationService- registerDevice()- unregisterDevice()
20.2 Routing endpoint contract
| Endpoint | Input | Output |
| GET /route | origin, destination, profile | distance, duration, geometry, legs, steps, routeId/version. |
| GET /match | GPS points + timestamps + profile | matched trace + road metadata. |


These endpoint names are logical. If using raw OSRM HTTP, map the service to OSRM’s /route/v1/{profile} and /match/v1/{profile} conventions. [10]
21. Journey State Machine
JourneyDRAFT  | create  vLOBBY  | creator/participant start  vACTIVE  |  +--> EXPIRED (creator expiry reached)  +--> CANCELLED (creator ends before start)  +--> COMPLETED (all participants finished / creator closes)ParticipantNOT_JOINED -> JOINED -> NOT_STARTED -> ACTIVE                               |          |                               |          +--> PAUSED -> ACTIVE                               |          +--> ARRIVED -> FINISHED                               |          +--> LEFT
Individual participants may start at different times. Journey-level ACTIVE means at least one participant is actively traveling or the creator has started the journey. The exact transition rule can be implemented as “journey status becomes ACTIVE when the first participant starts” because creator-start-before-others is explicitly required.
22. Business Logic Rules
Destination is immutable after journey creation.
A journey may never exceed 10 members.
A participant cannot start if they already have another active journey.
Creator can start even if the group has fewer than 10 members and even if invitees are still in the lobby.
Each participant independently selects origin and travel mode.
Participants can change their selected origin/travel mode before starting; after starting, changing them requires ending/restarting or an explicit route reset flow.
Live location is published only when sharingState is ACTIVE or PAUSED-with-last-known-display as defined by UX; no new GPS publication occurs while paused.
Pause retains the last known location and timestamp but must not keep publishing new coordinates.
Arrival triggers a soft arrival state, not automatic finish.
Finish stops live location for that participant.
Creator end stops the whole journey regardless of individual participant state.
Expiry is authoritative and stops new live updates.
A participant who loses network keeps local tracking and history buffering; other users see last known state until reconnect.
A participant who is removed immediately loses permission to read the journey.
Phone numbers are visible only to current journey members.
History is retained indefinitely unless a future deletion feature is introduced.
23. Performance and Reliability Targets
| Area | V1 target |
| Journey live update visibility | Typically under ~5-10 seconds while network is healthy, consistent with adaptive publish cadence. |
| Map interaction | 60 FPS target on mainstream Android devices where feasible; avoid React re-render storms from live updates. |
| Location CPU/battery | Adaptive sampling; avoid full-rate GPS publication while stationary. |
| Cold launch | Fast startup; defer non-critical history/map downloads. |
| Realtime payload | Current-state deltas; do not append every fix to a hot RTDB collection. |
| Offline recovery | Automatically resynchronize latest participant state and buffered history when online. |
| Journey size | Design and test for 10 participants; initial field testing around 50 total users. |


24. Observability
24.1 Metrics to instrument
Journey created / joined / started / finished / expired.
Time from Start Journey to first successful live location publish.
Live update publish rate per participant.
Average bytes written/read per active journey.
Realtime reconnect frequency.
Location service interruptions and reason category.
Battery drain per hour during active journey.
Route calculation latency and failure rate.
Offline map download success/failure and size.
Arrival detection false positives / false negatives.
Push notification delivery/open rates where available.
Crash-free sessions and Android device/OS distribution.
24.2 Debug logging
Never log raw phone numbers or full precision location history in ordinary application logs. Use journeyId/anonymous UID hashes, event categories, timestamps, and coarse diagnostics. A debug build may expose additional location diagnostics locally.
25. QA Strategy
25.1 Functional test matrix
| Case | Scenario | Expected |
| Create | Creator sets destination + expiry + invites | Journey created; invite link/QR/code work. |
| Join | User joins through link/QR/code | Member added exactly once; max 10 enforced. |
| Start | Creator starts with others in lobby | Creator tracks; others remain not-started. |
| Late start | Second traveler starts later | Second traveler appears as live only after their Start Journey. |
| Different origins | Three cities, one destination | Each route is independent; destination identical. |
| Navigation | Drive/bike/walk | Correct route profile and instructions. |
| Lock screen | Start then lock phone | Tracking continues via foreground service. |
| App background | Start then switch apps | Tracking continues. |
| Network loss | Disable data during journey | Own GPS/history continue; others show last-known state. |
| Reconnect | Restore network | Latest state syncs; queued history flushes safely. |
| Pause | Pause location sharing | No new coordinates; last known remains visible. |
| Resume | Resume sharing | Live updates restart. |
| Arrival | Enter destination geofence | Shows “You've arrived”; does not auto-finish. |
| Finish | Press Finish | Tracking service stops; participant becomes finished. |
| Expiry | Advance server time / test clock | Journey expires and rejects further live writes. |
| Removal | Creator removes member | Member loses access immediately. |
| Phone | Tap Call | Native dialer opens with participant number. |
| History | Complete journey | Journey remains indefinitely accessible. |
| Offline map | Download region, then go offline | Map renders from offline pack. |
| One active journey | Try to start second journey | Blocked with clear explanation. |


25.2 Hard device tests
Screen locked for 1+ hour.
Phone in battery saver mode.
Location services disabled after tracking starts.
Permission downgraded from precise to approximate.
App process killed by user/system and relaunched during active journey.
Network toggled repeatedly between Wi-Fi/mobile/offline.
Poor GPS in tunnels/urban canyons.
Phone reboot during active journey.
Low battery condition.
Large route download interrupted and resumed.
Journey expiry while device is offline.
Ten-member journey with all participants sending updates at once.
26. Acceptance Criteria for MVP
A user can create a journey without a traditional login.
Creator can set one shared destination and an expiry.
At least 9 invited participants can join; 10 total members is the hard maximum.
Participants can select different starting points and one of three travel modes.
Creator can start while other members remain in the lobby.
Every active participant can see every other active participant’s location on one map.
Own route is focused; other routes remain visible in group overview.
Navigation provides route geometry, ETA, remaining distance, turn instructions, and voice guidance.
Location tracking continues after screen lock/backgrounding once started from the visible Start Journey action.
Location frequency adapts between movement and stationary states.
Last known location is preserved when a participant disconnects.
Pause sharing stops new location publication while retaining last known state.
Arrival shows “You've arrived” and requires explicit Finish.
Creator can end the whole journey; expiry ends it automatically.
Phone number is visible to journey members with a direct Call action.
Group chat, travel quick-statuses, and basic emergency actions work.
Offline map can be explicitly downloaded and used without live tile access.
Completed journey history is retained indefinitely.
A second active journey cannot be started by the same user.
Security Rules prevent non-members from reading live/journey data.
Production builds use App Check/Play Integrity and appropriate Firebase protections.
27. Development Phases
| Phase | Deliverable |
| Phase 0 - Technical spikes | Background location FGS; MapLibre rendering/offline packs; OSRM route/steps; Firebase auth/rules; realtime update throughput. |
| Phase 1 - Core shell | React Native navigation, anonymous identity, profile, Home, Create/Join journey, Firebase schema. |
| Phase 2 - Group map | MapLibre map, participant markers, destination, live sync, route lines, traveler cards. |
| Phase 3 - Tracking engine | Kotlin foreground service, adaptive sampling, last-known behavior, pause/resume, finish. |
| Phase 4 - Navigation | Route calculation, route progress, maneuvers, voice guidance, off-route handling, route versions. |
| Phase 5 - Offline | Offline map download, cached route/steps, offline history buffer, reconnect synchronization. |
| Phase 6 - Coordination | Chat, quick statuses, phone/call, emergency sheet, push notifications. |
| Phase 7 - History/security | History viewer, strict rules, App Check, expiry enforcement, abuse/rate limiting. |
| Phase 8 - Hardening | Battery, background, poor network, 10-person load, crash/performance profiling, Play policy review, release build. |


28. Engineering Risks and Mitigations
| Risk | Severity | Mitigation |
| Android background tracking restrictions | High | Start the location FGS from a visible Start Journey action; validate target SDK and permissions on every release. [1][2][3] |
| Battery drain | High | Adaptive sampling, distance thresholds, motion-state logic, and field battery testing. |
| Realtime bandwidth | Medium | Publish latest live state only; 10-member cap; compression and throttled writes. |
| Offline routing complexity | High | V1 caches map + route + steps. Defer full local rerouting until a suitable on-device routing component is selected. |
| Tile licensing/availability | High | Use a licensed production tile source or self-hosted stack; do not depend on public OSM tile endpoints for production/offline bulk downloads. |
| Anonymous identity recovery | Medium | Document limitation; future recovery code or optional account linking. |
| Phone number privacy | Medium | Journey-only read rules, explicit disclosure, no public indexing. |
| Join-code brute force | Medium | Opaque token in links/QR, rate limits, code expiry, App Check. |
| Cloud Functions billing | Medium | Keep server functions small; set budget alerts. Firebase documents Functions on Blaze. [12][13] |
| Map/route provider changes | Medium | Keep MapLibre and routing behind repository/service interfaces. |


29. Comparable Products / Research Notes
The following products and open-source projects were reviewed to validate interaction patterns and technical approaches. They are references, not dependencies.
| Reference | What we take from it |
| Google Maps | Trip progress / ETA sharing validates destination-oriented temporary sharing, but V1 needs a dedicated multi-traveler journey surface. Google Navigation SDK currently states that it has no offline mode, so it is not selected as the core V1 navigation dependency. [8] |
| Life360 Temporary Circles | Strong precedent for temporary shared group maps, mutual visibility, creator-selected duration, and automatic closure. [14][15] |
| Glympse | Strong precedent for temporary location sharing, ETA, timers, private groups, and quick messages. [16] |
| HyperTrack Live App | Open-source example demonstrating live sharing, speed, bearing, recency, activity state, battery signals, and Firebase/FCM integration patterns. [17] |
| Paralino | Open-source location-sharing architecture demonstrating battery controls, history, background tracking, MapLibre, and privacy-focused design. [18] |
| Nearby Connections | Useful for future local peer-to-peer features, but not suitable as the sole global synchronization mechanism because the product must work across distant origins. [11] |


30. Release / Operations Checklist
Firebase project production environment created and rules tested in emulator.
App Check registered with Play Integrity; debug provider isolated from release builds.
FCM configured and notification channels defined.
Android foreground service permissions and manifest declarations verified against target SDK.
Location permission UX reviewed and tested on fresh installs and upgraded installs.
Routing service deployed, monitored, rate-limited, and protected from open abuse.
Production tile source licensing verified and offline usage permitted.
Privacy policy covers precise location, background/foreground tracking, phone numbers, profile information, chat, and indefinite journey history.
Google Play data safety disclosures prepared from actual SDK/data flows.
Crash reporting and basic performance monitoring enabled.
Budget alerts configured for Firebase/Cloud Functions and map/routing infrastructure.
Play Store background location policy requirements reviewed before submission.
Release builds tested on multiple real Android OEMs, not only emulator.
31. Implementation Notes for the First Repository
Start with a monorepo-like structure even though V1 ships only Android. Keep the shared TypeScript domain layer platform-neutral so iOS can be added later without redesigning journey logic. Keep Android-specific behavior behind a small native module boundary.
/shared-journey  /src  /android  /ios                  # reserved for later; can remain minimal in V1  /functions             # minimal trusted backend  /routing    /osrm  /docs    developer-handoff.md    firebase-rules.md    architecture.md  /tests
Use environment-specific Firebase projects for dev, staging, and production. Never ship development Firebase configuration or unrestricted rules in the production APK.
32. Suggested Initial Configuration Constants
| Constant | Initial value | Notes |
| MAX_MEMBERS | 10 | Includes creator. |
| LIVE_FAST_INTERVAL_MS | 2500-3000 | Starting point only. |
| LIVE_NORMAL_INTERVAL_MS | 5000 | Starting default. |
| LIVE_SLOW_INTERVAL_MS | 8000-10000 | Starting point. |
| LIVE_STATIONARY_INTERVAL_MS | 20000-30000 | Starting point. |
| MIN_PUBLISH_DISTANCE_M | 20-40 | Tune against route/urban accuracy. |
| STALE_WARNING_MS | 60000 | UI warning threshold; tune later. |
| ARRIVAL_RADIUS_M | 50-150 | Use route/place geometry; tune by travel mode. |
| ROUTE_REROUTE_THRESHOLD_M | 50-100 | Initial off-route threshold; route context dependent. |
| JOIN_CODE_TTL | Creator-selected expiry or shorter join token TTL | Longer-lived links can be allowed while journey is in lobby; validate abuse. |


These are engineering starting points. They should be parameterized remotely/configurably and tuned with real field testing rather than hard-coded product promises.
33. Final Architecture Summary
                          +-----------------------+                          |      Firebase         |                          |-----------------------|                          | Anonymous Auth        |                          | Realtime Database     |                          | FCM                   |                          | App Check             |                          | Minimal Functions    |                          +-----------+-----------+                                      ^                                      |                 live state / journey / events                                      |      +-------------------------------+-------------------------------+      |                               |                               |+-----+------+                 +------+-----+                   +-----+------+| Traveler A |                 | Traveler B |                   | Traveler C || React Ntv  |                 | React Ntv   |                   | React Ntv   || MapLibre   |                 | MapLibre    |                   | MapLibre    || Kotlin FGS |                 | Kotlin FGS  |                   | Kotlin FGS  |+-----+------+                 +------+-----+                   +-----+------+      |                               |                               |      +----------------------+--------+-------------------------------+                             |                             v                    +------------------+                    | Routing service  |                    | OSRM / provider  |                    +------------------+
This design balances the product requirement for live, mutually visible travel tracking with the engineering need for battery efficiency, offline resilience, permission compliance, and a small operational footprint. The key implementation discipline is to keep the live state small, keep authorization server-enforced, start Android background tracking correctly, and treat offline navigation as a deliberate cached-route capability rather than an accidental side effect.

34. Technical References
[1] Android Developers - Request location permissions - https://developer.android.com/develop/sensors-and-location/location/permissions
[2] Android Developers - Launch a foreground service - https://developer.android.com/develop/background-work/services/fgs/launch
[3] Android Developers - Declare foreground services and request permissions - https://developer.android.com/develop/background-work/services/fgs/declare
[4] Firebase - Realtime Database - https://firebase.google.com/docs/database
[5] Firebase - Authenticate anonymously on Android - https://firebase.google.com/docs/auth/android/anonymous-auth
[6] Firebase - App Check with Play Integrity on Android - https://firebase.google.com/docs/app-check/android/play-integrity-provider
[7] Firebase - Cloud Messaging for Android - https://firebase.google.com/docs/cloud-messaging/android/get-started
[8] Google Developers - Navigation SDK for Android FAQ - https://developers.google.com/maps/documentation/navigation/android-sdk/faq
[9] MapLibre React Native - OfflineManager - https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/
[10] OSRM - HTTP API documentation - https://project-osrm.org/docs/v26.4.0/http
[11] Google Developers - Nearby Connections - https://developers.google.com/nearby/overview
[12] Firebase - Cloud Functions documentation - https://firebase.google.com/docs/functions
[13] Firebase - Pricing plans - https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
[14] Life360 - Temporary Circles - https://www.life360.com/features/temporary-circles
[15] Life360 - Temporary group location sharing (Aug 10, 2026) - https://www.life360.com/en-au/blog/temporary-circles
[16] Glympse - Features - https://app.glympse.com/features/
[17] HyperTrack - Live Location Sharing Android sample - https://github.com/hypertrack/live-app-android
[18] Paralino - Open-source location sharing - https://github.com/paralino/paralino
Appendix A - Product Language
| Term | Definition |
| Journey | A shared trip with one common destination and up to 10 members. |
| Creator | The user who created the journey and controls the destination, member administration, and expiry. |
| Participant / Traveler | Any member of the journey, including the creator. |
| Lobby | Pre-start state in which members can join and configure their own origin/travel mode. |
| Active | A participant is actively sharing live location; the journey is considered operational once at least one participant has started. |
| Paused | Participant has stopped publishing new location while leaving their last known location visible. |
| Arrived | Participant is detected near the destination; user must explicitly Finish. |
| Finished | Participant has explicitly ended their own tracking. |
| Expired | Creator-selected expiry has been reached and live sharing is no longer permitted. |
| Live state | Latest participant location and derived status, not the full history log. |
| History | Persisted route/track representation for completed journeys. |


End of handoff document.