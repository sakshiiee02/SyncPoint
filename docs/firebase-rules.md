# Firebase Realtime Database: schema v2 and security rules

SyncPoint runs on the **free Spark plan with no Cloud Functions**, so everything that used to need
trusted server code is enforced by `database.rules.json` plus atomic multi-path writes.
The rules are verified by `npm run test:integration` (real rules, local emulator).

## Layout

```
/joinCodes/{CODE}                  { journeyId, expiresAt }          lookup by exact key only (no listing)
/userJourney/{uid}                 { journeyId, joinedAt, expiresAt } the ONE journey this user is in
/journeys/{journeyId}/
    meta       { name, status, creatorUid, joinCode, createdAt, startedAt?, expiresAt, destination, schemaVersion }
    seats/{0..9}   uid                                                 the member cap, see below
    members/{uid}  { name, username, phone, photoUrl?, mascot{animal,color}, seat, origin, travelMode, state, joinedAt, startedAt?, finishedAt? }
    live/{uid}     { lat, lng, heading, speedMps, batteryPct, charging?, status, lastUpdatedAt, currentRoad, ... }
    routes/{uid}   { polyline, distanceM, durationS, version, source, updatedAt }   shared so friends can draw it
    chat/{messageId}
```

`creator` is not a stored role: it is whoever `meta/creatorUid` points at, so ownership can be handed off.

## Who can do what

| Path | Read | Write |
| :--- | :--- | :--- |
| `joinCodes/{code}` | any signed-in user (exact key) | creator, only for a journey they create; a code can't be overwritten until it expires |
| `userJourney/{uid}` | that user | that user; may only replace an existing entry if it is expired, the journey ended/vanished, or they are no longer a member |
| `journeys/{id}/meta` | any signed-in user who knows the id (needed to preview before joining) | created once by the creator; `destination`, `expiresAt` immutable; status moves LOBBY→ACTIVE (any member, when they start), →COMPLETED/CANCELLED (creator, or the last member to finish), →EXPIRED (any member once server time ≥ `expiresAt`) |
| `journeys/{id}/seats/{n}` | any signed-in user | claim an **empty** seat for yourself (must come with your member record); release your own; creator may free any |
| `journeys/{id}/members` | members only | own record only; seat/joinedAt immutable; state may only follow WAITING→TRAVELING⇄PAUSED→ARRIVED→FINISHED; origin/mode frozen after start; creator may remove members |
| `journeys/{id}/live/{uid}` | members only | own record only, only while the journey is ACTIVE, not expired, and the member is TRAVELING/PAUSED/ARRIVED; fields range-checked; own/creator may delete |
| `journeys/{id}/routes/{uid}` | members only | own record only, while the journey is LOBBY/ACTIVE and the member is on the road; polyline capped at 100 KB; own/creator may delete |
| `journeys/{id}/chat/{msg}` | members only | members, as themselves, write-once, journey LOBBY/ACTIVE |

Everything else is denied (`.read`/`.write` default to `false`).

## How the "server-side" rules are enforced without a server

- **10-member cap** — each journey has 10 *seat* slots. A seat can only be written while empty, so two
  people racing for the last seat cannot both win; the loser retries and gets "journey full".
  A member record is only valid if it points at a seat that holds the writer's uid.
- **One active journey per user** — `userJourney/{uid}` can't be overwritten while it points at a live
  journey the user still belongs to.
- **Expiry** — rules compare against server `now`; live writes stop at `expiresAt` for every client,
  online or not. Clients also mark the journey `EXPIRED` when they notice.
- **Server time** — the app derives timestamps from `.info/serverTimeOffset`, so a phone with a wrong
  clock can't be rejected or extend a journey.

## Known limits (accepted on the free plan)

- Short codes are 6 characters of a 32-letter alphabet (~1 billion). There is no server-side rate
  limiting; protection is sign-in-required, code expiry, and (planned) Firebase App Check.
- There is no scheduler, so ended/expired journey nodes are not deleted automatically.
- "All travelers finished → COMPLETED" is performed by the last finisher's client; the rules only
  check that the writer has themselves finished.

## Deploying

```bash
npm i -g firebase-tools        # once
firebase login
firebase use <your-project-id>
firebase deploy --only database
```

Also enable **Authentication → Sign-in method → Anonymous** in the Firebase console.

## Testing

```bash
npm run test:integration       # starts the Auth + Database emulators and runs tests/integration/*.test.ts
```
