import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { AUTH_BASE_URL, USE_LOCAL } from '../constant';
import {
  isExpoGoEnvironment,
  loadGoogleSigninModule,
  nativeGoogleSignOutSilently,
} from '../lib/nativeGoogleSignin';
import { PLACEHOLDER_AVATAR } from '../services/userService';
import { setAuthToken } from '../services/api';

const SECURE_STORE_KEY = 'setfuel_auth_token';
/** Marker stored in SecureStore when signed in via Expo Go + local mode (no JWT). */
const EXPO_GO_OFFLINE_SESSION = '__setfuel_expo_go_local_offline__';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUri: string | null;
};

const EXPO_GO_DEV_USER: AuthUser = {
  id: 'local-user-1',
  displayName: 'Uday',
  email: 'uday@setfuel.app',
  avatarUri: PLACEHOLDER_AVATAR,
};

type AuthContextValue = {
  isSignedIn: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function exchangeGoogleToken(idToken: string): Promise<{ token: string; user: AuthUser }> {
  const url = `${AUTH_BASE_URL}/auth/google`;

  if (!AUTH_BASE_URL) {
    throw new Error('API URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in .env and restart Metro.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    throw new Error(`Cannot reach backend at ${url} — ${msg}`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `Auth failed (${res.status})`);
  }

  return res.json() as Promise<{ token: string; user: AuthUser }>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from SecureStore on app launch
  useEffect(() => {
    let cancelled = false;
    async function restoreSession() {
      try {
        const storedToken = await SecureStore.getItemAsync(SECURE_STORE_KEY);
        if (!storedToken) return;

        if (storedToken === EXPO_GO_OFFLINE_SESSION) {
          if (!cancelled && USE_LOCAL) {
            setAuthToken(null);
            setUser(EXPO_GO_DEV_USER);
            setIsSignedIn(true);
          } else if (!cancelled) {
            await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
            setAuthToken(null);
          }
          return;
        }

        // Validate the stored token is still accepted by the backend
        setAuthToken(storedToken);
        const profileRes = await fetch(`${AUTH_BASE_URL}/v1/user/profile`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!cancelled && profileRes.ok) {
          const profile = (await profileRes.json()) as AuthUser;
          setUser(profile);
          setIsSignedIn(true);
        } else {
          // Token rejected — clear stale credentials
          await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
          setAuthToken(null);
        }
      } catch {
        // Network error — keep the user signed out rather than crash
        setAuthToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isExpoGoEnvironment() && USE_LOCAL) {
      await SecureStore.setItemAsync(SECURE_STORE_KEY, EXPO_GO_OFFLINE_SESSION);
      setAuthToken(null);
      setUser(EXPO_GO_DEV_USER);
      setIsSignedIn(true);
      return;
    }
    if (isExpoGoEnvironment()) {
      throw new Error(
        'Google Sign-In is not available in Expo Go (native module RNGoogleSignin is missing).\n\n' +
          'Choose one:\n' +
          '• Run a dev build: from the mobile folder execute `npx expo run:android` (or install your EAS APK), then open that app—not Expo Go.\n' +
          '• Stay in Expo Go: set EXPO_PUBLIC_USE_LOCAL=true in mobile/.env, restart Metro with `npx expo start -c`, then tap Continue again for offline/local data (no Google).',
      );
    }

    let signInCancelledCode: string | number | undefined;
    try {
      const { GoogleSignin, statusCodes } = await loadGoogleSigninModule();
      signInCancelledCode = statusCodes.SIGN_IN_CANCELLED;
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      const idToken = signInResult.data?.idToken;
      if (!idToken) throw new Error('Google Sign-In did not return an idToken');

      const { token, user: authUser } = await exchangeGoogleToken(idToken);

      await SecureStore.setItemAsync(SECURE_STORE_KEY, token);
      setAuthToken(token);
      setUser(authUser);
      setIsSignedIn(true);
    } catch (e: unknown) {
      if (
        signInCancelledCode !== undefined &&
        e != null &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code: unknown }).code === signInCancelledCode
      ) {
        return;
      }
      throw e;
    }
  }, []);

  const signOut = useCallback(async () => {
    await nativeGoogleSignOutSilently();
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    setAuthToken(null);
    setUser(null);
    setIsSignedIn(false);
  }, []);

  const value = useMemo(
    () => ({ isSignedIn, user, isLoading, signInWithGoogle, signOut }),
    [isSignedIn, user, isLoading, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
