# Firebase Realtime Database Security Rules Matrix

| Path | Read Access | Write Access | Validation Rules |
| :--- | :--- | :--- | :--- |
| `/users/{uid}` | Authenticated users | Same `auth.uid === $uid` only | Requires `uid`, `name`, and `username` |
| `/journeys/{id}/meta` | Journey members only | Creator only | Destination is immutable after initial creation |
| `/journeys/{id}/members` | Journey members only | Self or Creator | Enforces max 10 members |
| `/journeys/{id}/live/{uid}` | Journey members only | Same `auth.uid === $uid` only | **Locked**: Can only write while status is `ACTIVE` and `expiresAt > now` |
| `/journeys/{id}/routes/{uid}` | Journey members only | Same `auth.uid === $uid` only | Route updates tied to active journey |
| `/journeys/{id}/chat/{msgId}`| Journey members only | Same sender only (`senderUid === auth.uid`) | Members cannot mutate others' messages |
| `/journeys/{id}/history/{uid}`| Journey members only | Same `auth.uid === $uid` only | Immutable once journey transitions to `COMPLETED` |
| `/joinCodes/{code}` | Authenticated users | Server-only (`write: false`) | Read lookup for invite resolution |
| `/activeJourneyByUser/{uid}` | Same `auth.uid === $uid` | Same `auth.uid === $uid` | Enforces one active journey per traveler |
