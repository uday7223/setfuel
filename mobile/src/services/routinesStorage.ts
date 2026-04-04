/**
 * Persists user workout programs on device.
 * New users start with an empty list; optional templates live in `personalRoutines.ts`.
 *
 * - **Web (Expo web):** `localStorage` — AsyncStorage’s native module is not available there.
 * - **iOS / Android:** `@react-native-async-storage/async-storage`.
 * - **Fallback:** in-memory map if native module fails (e.g. misconfigured dev client).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { PERSONAL_ROUTINES } from '../data/personalRoutines';
import type { PersonalRoutine } from '../types';

const STORAGE_KEY = '@setfuel/personal_routines_v1';

const isWeb = Platform.OS === 'web';

/** Last-resort when AsyncStorage native module is null (e.g. web or broken link). */
const memoryFallback = new Map<string, string>();

function webGetItem(key: string): string | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage.getItem(key);
    }
  } catch {
    /* private mode / SSR */
  }
  return null;
}

function webSetItem(key: string, value: string): void {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
    }
  } catch {
    /* quota / private mode */
  }
}

async function storageGetItem(key: string): Promise<string | null> {
  if (isWeb) {
    return webGetItem(key);
  }
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryFallback.get(key) ?? null;
  }
}

async function storageSetItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    webSetItem(key, value);
    return;
  }
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    memoryFallback.set(key, value);
  }
}

function deepCloneRoutines(routines: PersonalRoutine[]): PersonalRoutine[] {
  return JSON.parse(JSON.stringify(routines)) as PersonalRoutine[];
}

/**
 * Loads saved programs. Missing key = new user → persist `[]` and return empty.
 * Empty array `[]` in storage is valid (user cleared all programs).
 */
export async function loadRoutines(): Promise<PersonalRoutine[]> {
  try {
    const raw = await storageGetItem(STORAGE_KEY);
    if (raw === null) {
      await storageSetItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw) as PersonalRoutine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRoutines(routines: PersonalRoutine[]): Promise<void> {
  await storageSetItem(STORAGE_KEY, JSON.stringify(routines));
}

/** Replaces storage with the built-in template list from `personalRoutines.ts`. */
export async function resetRoutinesToDefaults(): Promise<PersonalRoutine[]> {
  const seed = deepCloneRoutines(PERSONAL_ROUTINES);
  await saveRoutines(seed);
  return seed;
}
