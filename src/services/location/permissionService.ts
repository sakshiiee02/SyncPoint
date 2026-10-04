import { PermissionsAndroid, Platform } from 'react-native';

export interface PermissionStatus {
  hasFineLocation: boolean;
  hasNotification: boolean;
}

/**
 * Handles Android runtime permission flows with pre-permission rationales.
 * Matches Section 8.3 and Section 189 of Developer Handoff.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // 1. Request Fine Location with user-friendly educational rationale
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Sharing for Convoy Tracking',
        message:
          'SyncPoint needs your location during the active trip to display your progress to fellow travelers on the group map and provide turn navigation.',
        buttonNeutral: 'Ask Later',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow Precise Location',
      }
    );

    // The caller explains what to do next (and can offer to open Settings).
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false;

    // 2. Android 13+ Notification Permission for Foreground Service
    if (Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Journey Progress Notifications',
          message:
            'Shows an ongoing notification with your ETA, remaining distance, and quick pause controls while traveling.',
          buttonPositive: 'OK',
        }
      );
    }

    return true;
  } catch (err) {
    console.warn('[PermissionService] Failed to request permissions:', err);
    return false;
  }
}
