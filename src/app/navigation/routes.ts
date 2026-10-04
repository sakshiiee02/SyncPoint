/**
 * Navigation map. The stack is deliberately shallow so the hardware back button always does
 * the obvious thing:
 *
 *   Home ─┬─ CreateJourney ──(created)──▶ [Home, JourneyLobby]
 *         ├─ JoinJourney ─ JourneySetup ─(joined)─▶ [Home, JourneyLobby]
 *         ├─ JourneyLobby ──(start)──▶ [Home, ActiveJourney] ─ JourneyChat
 *         ├─ HistoryDetail
 *         └─ Profile
 *
 * Back from Lobby / Active returns to Home and the journey keeps running; Home then shows a
 * "resume" card. Leaving or ending a journey is always an explicit button.
 */
import { PickerTarget } from '@/domain/placeMapping';

export type RootStackParamList = {
  ProfileSetup: undefined;
  Home: undefined;
  Profile: undefined;
  CreateJourney: undefined;
  JoinJourney: { code?: string } | undefined;
  JourneySetup: { journeyId: string; journeyName: string; destinationName: string };
  JourneyLobby: undefined;
  ActiveJourney: undefined;
  JourneyChat: undefined;
  HistoryDetail: { journeyId: string };
  PlacePicker: { target: PickerTarget; title: string; allowCurrentLocation: boolean };
};

export type ResumeRoute = 'JourneyLobby' | 'ActiveJourney';
