/** Single source of truth for Realtime Database paths (schema v2). */
export const Paths = {
  joinCode: (code: string) => `joinCodes/${code}`,
  userJourney: (uid: string) => `userJourney/${uid}`,

  journeys: () => 'journeys',
  journey: (journeyId: string) => `journeys/${journeyId}`,
  meta: (journeyId: string) => `journeys/${journeyId}/meta`,
  seats: (journeyId: string) => `journeys/${journeyId}/seats`,
  seat: (journeyId: string, seat: number | string) => `journeys/${journeyId}/seats/${seat}`,
  members: (journeyId: string) => `journeys/${journeyId}/members`,
  member: (journeyId: string, uid: string) => `journeys/${journeyId}/members/${uid}`,
  live: (journeyId: string) => `journeys/${journeyId}/live`,
  liveOf: (journeyId: string, uid: string) => `journeys/${journeyId}/live/${uid}`,
  routes: (journeyId: string) => `journeys/${journeyId}/routes`,
  routeOf: (journeyId: string, uid: string) => `journeys/${journeyId}/routes/${uid}`,
  chat: (journeyId: string) => `journeys/${journeyId}/chat`,
  chatMessage: (journeyId: string, messageId: string) =>
    `journeys/${journeyId}/chat/${messageId}`,
} as const;
