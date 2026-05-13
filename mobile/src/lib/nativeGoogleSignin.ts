import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from '../constant';

/** Shown when the JS bundle runs inside Expo Go, which does not ship RNGoogleSignin. */
export const GOOGLE_NATIVE_UNAVAILABLE_EXPO_GO =
  'Google Sign-In is not available in Expo Go (native module RNGoogleSignin is missing). Use a dev build: from the mobile folder run `npx expo run:android`, or install your EAS APK, and open that app—not Expo Go.';

let configureOnce = false;

export function isNativeGoogleSignInSupported(): boolean {
  if (Platform.OS === 'web') return false;
  return Constants.appOwnership !== 'expo';
}

/**
 * Dynamically loads @react-native-google-signin/google-signin so Expo Go never touches the
 * TurboModule at startup (avoids Invariant Violation: RNGoogleSignin could not be found).
 */
export async function loadGoogleSigninModule(): Promise<
  typeof import('@react-native-google-signin/google-signin')
> {
  if (Platform.OS === 'web') {
    throw new Error('Google Sign-In is not supported on web in this build.');
  }
  if (Constants.appOwnership === 'expo') {
    throw new Error(GOOGLE_NATIVE_UNAVAILABLE_EXPO_GO);
  }

  const webClientId = GOOGLE_WEB_CLIENT_ID.trim();
  if (!webClientId) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in mobile/.env (must match backend GOOGLE_CLIENT_ID). Restart Metro after editing.',
    );
  }

  const mod = await import('@react-native-google-signin/google-signin');

  if (!configureOnce) {
    mod.GoogleSignin.configure({
      webClientId,
      offlineAccess: false,
    });
    configureOnce = true;
  }

  return mod;
}

/** Best-effort Google session revoke when native module exists (dev client / store build). */
export async function nativeGoogleSignOutSilently(): Promise<void> {
  if (!isNativeGoogleSignInSupported()) return;
  try {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    await GoogleSignin.signOut();
  } catch {
    /* no-op: module missing or not signed in with Google */
  }
}
