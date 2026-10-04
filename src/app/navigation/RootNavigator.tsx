import React, { useCallback, useEffect, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import {
  DefaultTheme,
  NavigationContainer,
  createNavigationContainerRef,
  InitialState,
} from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { BootScreen } from '@/app/BootScreen';
import { useBootstrap } from '@/app/useBootstrap';
import { parseInviteCode } from '@/domain/inviteLink';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { CreateJourneyScreen } from '@/features/journey/create/CreateJourneyScreen';
import { JoinJourneyScreen } from '@/features/journey/join/JoinJourneyScreen';
import { OriginTravelModeScreen } from '@/features/journey/join/OriginTravelModeScreen';
import { JourneyLobbyScreen } from '@/features/journey/lobby/JourneyLobbyScreen';
import { ActiveJourneyScreen } from '@/features/journey/active/ActiveJourneyScreen';
import { JourneyChatScreen } from '@/features/journey/chat/JourneyChatScreen';
import { HistoryDetailScreen } from '@/features/journey/history/HistoryDetailScreen';
import { PlacePickerScreen } from '@/features/places/PlacePickerScreen';
import { ToastHost } from '@/components/common/ToastHost';
import { PickerTarget } from '@/domain/placeMapping';
import { usePlacePickerStore } from '@/store/usePlacePickerStore';
import { JourneyEndReason, useJourneyStore } from '@/store/useJourneyStore';
import { useProfileStore } from '@/store/useProfileStore';
import { ResumeRoute, RootStackParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type Props<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

function goHome() {
  if (navigationRef.isReady()) navigationRef.reset({ index: 0, routes: [{ name: 'Home' }] });
}

function goHomeThen(route: 'JourneyLobby' | 'ActiveJourney') {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 1, routes: [{ name: 'Home' }, { name: route }] });
  }
}

/** Where "my journey" currently lives: the lobby until I press Start, the live map after. */
function currentJourneyRoute(): 'JourneyLobby' | 'ActiveJourney' {
  const { members } = useJourneyStore.getState();
  const uid = useProfileStore.getState().uid;
  const me = uid ? members[uid] : undefined;
  return me && me.state !== 'WAITING' ? 'ActiveJourney' : 'JourneyLobby';
}

/** Opens the place picker for a destination or a starting point. */
function openPicker(
  navigation: { navigate: (name: 'PlacePicker', params: RootStackParamList['PlacePicker']) => void },
  target: PickerTarget
) {
  navigation.navigate('PlacePicker', {
    target,
    title: target === 'destination' ? 'Choose destination' : 'Choose starting point',
    allowCurrentLocation: target === 'origin',
  });
}

// ── Route wrappers: the only place screens meet the navigation library ───────────────────

const HomeRoute = ({ navigation }: Props<'Home'>) => (
  <HomeScreen
    onCreateJourney={() => navigation.navigate('CreateJourney')}
    onJoinJourney={() => navigation.navigate('JoinJourney')}
    onResumeJourney={() => navigation.navigate(currentJourneyRoute())}
    onOpenProfile={() => navigation.navigate('Profile')}
    onOpenHistory={(journeyId) => navigation.navigate('HistoryDetail', { journeyId })}
  />
);

const ProfileSetupRoute = () => <ProfileScreen isFirstLaunch />;

const ProfileRoute = ({ navigation }: Props<'Profile'>) => (
  <ProfileScreen onSaved={() => navigation.goBack()} />
);

const CreateRoute = ({ navigation }: Props<'CreateJourney'>) => (
  <CreateJourneyScreen
    onJourneyCreated={() => goHomeThen('JourneyLobby')}
    onPickPlace={(target) => openPicker(navigation, target)}
    onCancel={() => navigation.goBack()}
  />
);

const JoinRoute = ({ navigation, route }: Props<'JoinJourney'>) => (
  <JoinJourneyScreen
    initialCode={route.params?.code}
    onJourneyResolved={(preview) =>
      navigation.navigate('JourneySetup', {
        journeyId: preview.meta.journeyId,
        journeyName: preview.meta.name,
        destinationName: preview.meta.destination.displayName,
      })
    }
    onCancel={() => navigation.goBack()}
  />
);

const SetupRoute = ({ navigation, route }: Props<'JourneySetup'>) => (
  <OriginTravelModeScreen
    journeyId={route.params.journeyId}
    journeyName={route.params.journeyName}
    destinationName={route.params.destinationName}
    onJoined={() => goHomeThen(currentJourneyRoute())}
    onResumeExisting={() => goHomeThen(currentJourneyRoute())}
    onPickPlace={(target) => openPicker(navigation, target)}
    onCancel={() => navigation.goBack()}
  />
);

const LobbyRoute = ({ navigation }: Props<'JourneyLobby'>) => (
  <JourneyLobbyScreen
    onStarted={() => navigation.replace('ActiveJourney')}
    onLeft={goHome}
    onBack={() => navigation.goBack()}
    onPickPlace={(target) => openPicker(navigation, target)}
  />
);

const ActiveRoute = ({ navigation }: Props<'ActiveJourney'>) => (
  <ActiveJourneyScreen
    onExit={goHome}
    onBack={() => navigation.goBack()}
    onOpenChat={() => navigation.navigate('JourneyChat')}
  />
);

const ChatRoute = ({ navigation }: Props<'JourneyChat'>) => {
  const journey = useJourneyStore((s) => s.currentJourney);
  return (
    <JourneyChatScreen
      journeyId={journey?.journeyId ?? ''}
      journeyName={journey?.name ?? 'Journey'}
      onClose={() => navigation.goBack()}
      onOpenEmergency={() => navigation.goBack()}
    />
  );
};

const PlacePickerRoute = ({ navigation, route }: Props<'PlacePicker'>) => (
  <PlacePickerScreen
    title={route.params.title}
    allowCurrentLocation={route.params.allowCurrentLocation}
    onPicked={(picked) => {
      usePlacePickerStore.getState().setPicked(route.params.target, picked);
      navigation.goBack();
    }}
    onCancel={() => navigation.goBack()}
  />
);

const HistoryRoute = ({ navigation, route }: Props<'HistoryDetail'>) => (
  <HistoryDetailScreen journeyId={route.params.journeyId} onClose={() => navigation.goBack()} />
);

// ── App-wide watchers ────────────────────────────────────────────────────────────────────

const END_MESSAGES: Record<JourneyEndReason, { title: string; message: string }> = {
  COMPLETED: { title: 'Journey ended', message: 'This journey has ended.' },
  CANCELLED: { title: 'Journey cancelled', message: 'The host cancelled this journey.' },
  EXPIRED: { title: 'Journey expired', message: 'The journey reached its expiry time.' },
  REMOVED: { title: 'Removed from journey', message: 'You are no longer part of this journey.' },
};

/** Shows one message and returns to Home whenever the journey ends for reasons outside the user's control. */
const JourneyEndWatcher: React.FC = () => {
  const reason = useJourneyStore((s) => s.endedReason);
  useEffect(() => {
    if (!reason) return;
    const { title, message } = END_MESSAGES[reason];
    Alert.alert(title, message);
    useJourneyStore.getState().resetJourney();
    goHome();
  }, [reason]);
  return null;
};

/** Turns syncpoint://join/CODE and https://<domain>/join/CODE links into the Join screen. */
const InviteLinkHandler: React.FC = () => {
  const hasProfile = useProfileStore((s) => s.hasCompletedProfile);
  const pendingCode = useRef<string | null>(null);
  const hasProfileRef = useRef(hasProfile);
  hasProfileRef.current = hasProfile;

  const flush = useCallback(() => {
    if (pendingCode.current && hasProfileRef.current && navigationRef.isReady()) {
      navigationRef.navigate('JoinJourney', { code: pendingCode.current });
      pendingCode.current = null;
    }
  }, []);

  useEffect(() => {
    const handle = (url: string | null) => {
      const code = url ? parseInviteCode(url) : null;
      if (!code) return;
      pendingCode.current = code;
      flush();
    };
    Linking.getInitialURL().then(handle).catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => handle(event.url));
    return () => subscription.remove();
  }, [flush]);

  // A link opened before the profile existed is delivered once the profile is saved.
  useEffect(() => {
    flush();
  }, [hasProfile, flush]);

  return null;
};

// ── Navigator ────────────────────────────────────────────────────────────────────────────

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: '#f8fafc' } };

const ReadyNavigator: React.FC<{ resumeRoute: ResumeRoute | null }> = ({ resumeRoute }) => {
  const hasCompletedProfile = useProfileStore((s) => s.hasCompletedProfile);

  const initialState = useRef<InitialState | undefined>(
    resumeRoute && hasCompletedProfile
      ? { index: 1, routes: [{ name: 'Home' }, { name: resumeRoute }] }
      : undefined
  ).current;

  return (
    <NavigationContainer ref={navigationRef} theme={theme} initialState={initialState}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!hasCompletedProfile ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupRoute} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeRoute} />
            <Stack.Screen name="Profile" component={ProfileRoute} />
            <Stack.Screen name="CreateJourney" component={CreateRoute} />
            <Stack.Screen name="JoinJourney" component={JoinRoute} />
            <Stack.Screen name="JourneySetup" component={SetupRoute} />
            <Stack.Screen name="JourneyLobby" component={LobbyRoute} />
            <Stack.Screen name="ActiveJourney" component={ActiveRoute} />
            <Stack.Screen name="JourneyChat" component={ChatRoute} />
            <Stack.Screen name="HistoryDetail" component={HistoryRoute} />
            <Stack.Screen name="PlacePicker" component={PlacePickerRoute} />
          </>
        )}
      </Stack.Navigator>
      <JourneyEndWatcher />
      <ToastHost />
      <InviteLinkHandler />
    </NavigationContainer>
  );
};

export const RootNavigator: React.FC = () => {
  const { state, retry } = useBootstrap();
  if (state.status !== 'ready') return <BootScreen state={state} onRetry={retry} />;
  return <ReadyNavigator resumeRoute={state.resumeRoute} />;
};
