import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from '../constant';

const EXPO_GO_NATIVE_BLOCK =
  'RNGoogleSignin is not available in Expo Go. Use `npx expo run:android` / an EAS APK, or set EXPO_PUBLIC_USE_LOCAL=true for offline Expo Go (see login instructions).';

let configureOnce = false;

/**
 * True when the JS runs inside the store Expo Go client (no custom native binary).
 * Uses executionEnvironment + appOwnership for SDK 54 compatibility.
 */
export function isExpoGoEnvironment(): boolean {
  if (Constants.appOwnership === 'expo') return true;
  if (Constants.executionEnvironment === 'storeClient') return true;
  return false;
}

export function isNativeGoogleSignInSupported(): boolean {
  if (Platform.OS === 'web') return false;
  return !isExpoGoEnvironment();
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
  if (isExpoGoEnvironment()) {
    throw new Error(EXPO_GO_NATIVE_BLOCK);
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
