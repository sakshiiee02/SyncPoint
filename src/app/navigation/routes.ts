import { Destination } from '@/types/journey';

export type RootStackParamList = {
  Home: undefined;
  Profile: { isFirstLaunch?: boolean } | undefined;
  CreateJourney: undefined;
  JoinJourney: undefined;
  OriginTravelMode: {
    journeyId: string;
    journeyName: string;
    destination: Destination;
  };
  JourneyLobby: {
    journeyId: string;
    joinCode: string;
  };
  ActiveJourney: {
    journeyId: string;
  };
  JourneyHistory: undefined;
};
