import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ensureAnonymousAuth } from '@/services/firebase/authService';
import { useProfileStore } from '@/store/useProfileStore';
import { useJourneyStore } from '@/store/useJourneyStore';
import { HomeScreen } from '@/features/home/HomeScreen';
import { ProfileScreen } from '@/features/profile/ProfileScreen';
import { CreateJourneyScreen } from '@/features/journey/create/CreateJourneyScreen';
import { JoinJourneyScreen } from '@/features/journey/join/JoinJourneyScreen';
import { OriginTravelModeScreen } from '@/features/journey/join/OriginTravelModeScreen';
import { JourneyLobbyScreen } from '@/features/journey/lobby/JourneyLobbyScreen';
import { ActiveJourneyScreen } from '@/features/journey/active/ActiveJourneyScreen';
import { JourneyChatScreen } from '@/features/journey/chat/JourneyChatScreen';
import { JourneyMeta } from '@/types/journey';

type ScreenName =
  | 'Home'
  | 'Profile'
  | 'CreateJourney'
  | 'JoinJourney'
  | 'OriginTravelMode'
  | 'JourneyLobby'
  | 'ActiveJourney'
  | 'JourneyChat';

export const RootNavigator: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenName>('Home');
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [pendingJoinJourney, setPendingJoinJourney] = useState<JourneyMeta | null>(null);

  const { hasCompletedProfile, setUid } = useProfileStore();
  const { currentJourney, activeJoinCode } = useJourneyStore();

  useEffect(() => {
    async function bootstrap() {
      try {
        const user = await ensureAnonymousAuth();
        if (user && user.uid) {
          setUid(user.uid);
        }
      } catch (e) {
        console.warn('[SyncPoint Boot] Anonymous auth initialization deferred:', e);
      } finally {
        setIsBootstrapping(false);
      }
    }
    bootstrap();
  }, [setUid]);

  if (isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#06b6d4" />
      </View>
    );
  }

  // Force profile creation on first launch (Section 5.1)
  if (!hasCompletedProfile && currentScreen !== 'Profile') {
    return <ProfileScreen isFirstLaunch onSaved={() => setCurrentScreen('Home')} />;
  }

  switch (currentScreen) {
    case 'Profile':
      return <ProfileScreen onSaved={() => setCurrentScreen('Home')} />;

    case 'CreateJourney':
      return (
        <CreateJourneyScreen
          onJourneyCreated={(_journeyId, _joinCode) => {
            setCurrentScreen('JourneyLobby');
          }}
          onCancel={() => setCurrentScreen('Home')}
        />
      );

    case 'JoinJourney':
      return (
        <JoinJourneyScreen
          onJourneyResolved={(journey, _code) => {
            setPendingJoinJourney(journey);
            setCurrentScreen('OriginTravelMode');
          }}
          onCancel={() => setCurrentScreen('Home')}
        />
      );

    case 'OriginTravelMode':
      if (!pendingJoinJourney) {
        return (
          <HomeScreen
            onCreateJourney={() => setCurrentScreen('CreateJourney')}
            onJoinJourney={() => setCurrentScreen('JoinJourney')}
            onOpenJourney={() => setCurrentScreen('JourneyLobby')}
            onOpenProfile={() => setCurrentScreen('Profile')}
          />
        );
      }
      return (
        <OriginTravelModeScreen
          journeyId={pendingJoinJourney.journeyId}
          journeyName={pendingJoinJourney.name}
          destination={pendingJoinJourney.destination}
          onJoined={() => setCurrentScreen('JourneyLobby')}
          onCancel={() => setCurrentScreen('Home')}
        />
      );

    case 'JourneyLobby':
      return (
        <JourneyLobbyScreen
          journeyId={currentJourney?.journeyId || ''}
          joinCode={activeJoinCode || ''}
          onStartTracking={() => {
            setCurrentScreen('ActiveJourney');
          }}
          onLeave={() => setCurrentScreen('Home')}
        />
      );

    case 'ActiveJourney':
      return (
        <ActiveJourneyScreen
          journeyId={currentJourney?.journeyId || ''}
          onExit={() => setCurrentScreen('Home')}
          onOpenChat={() => setCurrentScreen('JourneyChat')}
        />
      );

    case 'JourneyChat':
      return (
        <JourneyChatScreen
          journeyId={currentJourney?.journeyId || ''}
          journeyName={currentJourney?.name || 'Convoy'}
          onClose={() => setCurrentScreen('ActiveJourney')}
          onOpenEmergency={() => setCurrentScreen('ActiveJourney')}
        />
      );

    case 'Home':
    default:
      return (
        <HomeScreen
          onCreateJourney={() => setCurrentScreen('CreateJourney')}
          onJoinJourney={() => setCurrentScreen('JoinJourney')}
          onOpenJourney={(_journeyId) => setCurrentScreen('ActiveJourney')}
          onOpenProfile={() => setCurrentScreen('Profile')}
        />
      );
  }
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
