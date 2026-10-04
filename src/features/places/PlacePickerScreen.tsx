import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { CONFIG } from '@/constants/config';
import { PickedPlace, mapPinPlace } from '@/domain/placeMapping';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { LocationBridge } from '@/services/location/LocationBridge';
import { PlaceResult, placeSearch, recentPlaces } from '@/services/places';
import { BackIcon, NavigationArrowIcon, PinIcon, SearchIcon } from '@/components/common/Icons';

interface PlacePickerScreenProps {
  title: string;
  /** Offer "Use my current location" (for starting points). */
  allowCurrentLocation: boolean;
  onPicked: (picked: PickedPlace) => void;
  onCancel: () => void;
}

type Tab = 'SEARCH' | 'MAP';

const INDIA_CENTER: [number, number] = [78.9629, 20.5937];

export const PlacePickerScreen: React.FC<PlacePickerScreenProps> = ({
  title,
  allowCurrentLocation,
  onPicked,
  onCancel,
}) => {
  const [tab, setTab] = useState<Tab>('SEARCH');
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<PlaceResult[]>([]);
  const [here, setHere] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const { state, setQuery: search } = usePlaceSearch(here);

  useEffect(() => {
    recentPlaces.list().then(setRecents);
    // Bias results toward the user if permission is already granted (never prompts here).
    LocationBridge.getCurrentPosition(4000)
      .then((p) => setHere({ lat: p.latitude, lng: p.longitude }))
      .catch(() => undefined);
  }, []);

  const choose = (place: PlaceResult) => {
    Keyboard.dismiss();
    recentPlaces.add(place).catch(() => undefined);
    onPicked({ type: 'PLACE', place });
  };

  const onChangeText = (text: string) => {
    setQuery(text);
    search(text);
  };

  const list = state.status === 'idle' ? recents : state.results;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backButton} activeOpacity={0.7}>
          <BackIcon size={20} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.tabs}>
        {(['SEARCH', 'MAP'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => {
              Keyboard.dismiss();
              setTab(t);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'SEARCH' ? 'Search' : 'Pick on map'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'SEARCH' ? (
        <View style={styles.flex}>
          <View style={styles.searchBox}>
            <SearchIcon size={18} color="#64748b" />
            <TextInput
              style={styles.input}
              placeholder="Search any city, landmark or address"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={onChangeText}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {state.status === 'loading' && <ActivityIndicator size="small" color="#2563eb" />}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results}>
            {allowCurrentLocation && (
              <TouchableOpacity
                style={styles.row}
                onPress={() => onPicked({ type: 'CURRENT_LOCATION' })}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIcon, styles.rowIconAccent]}>
                  <NavigationArrowIcon size={16} color="#ffffff" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Use my current location</Text>
                  <Text style={styles.rowSub}>Your route starts from where you are when you press Start</Text>
                </View>
              </TouchableOpacity>
            )}

            {state.status === 'idle' && recents.length > 0 && <Text style={styles.sectionLabel}>Recent</Text>}

            {list.map((place) => (
              <TouchableOpacity key={place.id} style={styles.row} onPress={() => choose(place)} activeOpacity={0.7}>
                <View style={styles.rowIcon}>
                  <PinIcon size={16} color="#475569" />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={2}>
                    {place.address}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            <Message state={state.status} query={query} onUseMap={() => setTab('MAP')} hasRecents={recents.length > 0} />

            <Text style={styles.attribution}>
              Search by Geoapify and LocationIQ. Map data © OpenStreetMap contributors.
            </Text>
          </ScrollView>
        </View>
      ) : (
        <MapPinPicker here={here} onConfirm={(place) => onPicked({ type: 'PLACE', place })} />
      )}
    </View>
  );
};

const Message: React.FC<{
  state: string;
  query: string;
  onUseMap: () => void;
  hasRecents: boolean;
}> = ({ state, query, onUseMap, hasRecents }) => {
  switch (state) {
    case 'idle':
      return hasRecents ? null : <Text style={styles.hint}>Start typing to search. Try a city, a landmark or a street.</Text>;
    case 'too-short':
      return <Text style={styles.hint}>Keep typing...</Text>;
    case 'empty':
      return (
        <View>
          <Text style={styles.hint}>No places found for "{query.trim()}". Check the spelling, or</Text>
          <TouchableOpacity onPress={onUseMap}>
            <Text style={styles.link}>pick the spot on the map</Text>
          </TouchableOpacity>
        </View>
      );
    case 'unavailable':
      return (
        <View>
          <Text style={styles.hint}>Search isn't available right now (offline, or today's free limit was reached).</Text>
          <TouchableOpacity onPress={onUseMap}>
            <Text style={styles.link}>Pick the spot on the map instead</Text>
          </TouchableOpacity>
        </View>
      );
    case 'error':
      return <Text style={styles.hint}>Something went wrong while searching. Check your connection and try again.</Text>;
    default:
      return null;
  }
};

const MapPinPicker: React.FC<{
  here?: { lat: number; lng: number };
  onConfirm: (place: PlaceResult) => void;
}> = ({ here, onConfirm }) => {
  const cameraRef = useRef<MapLibreGL.CameraRef>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(here ?? null);
  const [found, setFound] = useState<PlaceResult | null>(null);
  const [resolving, setResolving] = useState(false);

  // Look up the address once the map stops moving.
  useEffect(() => {
    if (!center) return;
    setResolving(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      placeSearch
        .reverse(center.lat, center.lng, controller.signal)
        .then((p) => !controller.signal.aborted && setFound(p))
        .catch(() => !controller.signal.aborted && setFound(null))
        .finally(() => !controller.signal.aborted && setResolving(false));
    }, 500);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [center]);

  const goToMe = async () => {
    try {
      const p = await LocationBridge.getCurrentPosition(8000);
      cameraRef.current?.setCamera({
        centerCoordinate: [p.longitude, p.latitude],
        zoomLevel: 15,
        animationDuration: 500,
      });
    } catch {
      // No permission / GPS off: the user can still move the map by hand.
    }
  };

  const label = found ? found.name : center ? 'Dropped pin' : 'Move the map to choose a spot';
  const sub = found ? found.address : center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : '';

  return (
    <View style={styles.flex}>
      <MapLibreGL.MapView
        style={styles.flex}
        mapStyle={CONFIG.MAP.TILE_URL}
        logoEnabled={false}
        attributionEnabled
        onRegionDidChange={(feature: any) => {
          const [lng, lat] = feature.geometry.coordinates as [number, number];
          setCenter({ lat, lng });
        }}
        regionDidChangeDebounceTime={400}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: here ? [here.lng, here.lat] : INDIA_CENTER,
            zoomLevel: here ? 14 : 4,
          }}
        />
      </MapLibreGL.MapView>

      {/* Fixed pin: the spot under it is what gets chosen. */}
      <View style={styles.pinWrap} pointerEvents="none">
        <PinIcon size={36} color="#dc2626" />
      </View>

      <TouchableOpacity style={styles.locateButton} onPress={goToMe} activeOpacity={0.8}>
        <NavigationArrowIcon size={18} color="#2563eb" />
      </TouchableOpacity>

      <View style={styles.confirmCard}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.rowSub} numberOfLines={2}>
          {resolving ? 'Looking up address...' : sub}
        </Text>
        <TouchableOpacity
          style={[styles.confirmButton, !center && styles.confirmDisabled]}
          disabled={!center}
          onPress={() => center && onConfirm(mapPinPlace(center.lat, center.lng, found))}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmText}>Confirm this location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 8 },
  backButton: { padding: 6 },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#e2e8f0', borderRadius: 12, padding: 3 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: '#ffffff' },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#0f172a' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 11, fontSize: 15, color: '#0f172a' },
  results: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  rowIconAccent: { backgroundColor: '#2563eb' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  rowSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  hint: { fontSize: 13, color: '#64748b', lineHeight: 19, marginTop: 14 },
  link: { fontSize: 13, fontWeight: '700', color: '#2563eb', marginTop: 2 },
  attribution: { fontSize: 10, color: '#94a3b8', marginTop: 24, textAlign: 'center' },
  pinWrap: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36 },
  locateButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 11,
    elevation: 4,
  },
  confirmCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    elevation: 6,
  },
  confirmButton: { marginTop: 12, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  confirmDisabled: { backgroundColor: '#94a3b8' },
  confirmText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
