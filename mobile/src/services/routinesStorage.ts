/**
 * Persists user workout programs on device.
 * New users start with an empty list; optional templates live in `personalRoutines.ts`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PERSONAL_ROUTINES } from '../data/personalRoutines';
import type { PersonalRoutine } from '../types';

const STORAGE_KEY = '@setfuel/personal_routines_v1';

function deepCloneRoutines(routines: PersonalRoutine[]): PersonalRoutine[] {
  return JSON.parse(JSON.stringify(routines)) as PersonalRoutine[];
}

/**
 * Loads saved programs. Missing key = new user → persist `[]` and return empty.
 * Empty array `[]` in storage is valid (user cleared all programs).
 */
export async function loadRoutines(): Promise<PersonalRoutine[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw) as PersonalRoutine[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveRoutines(routines: PersonalRoutine[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
}

/** Replaces storage with the built-in template list from `personalRoutines.ts`. */
export async function resetRoutinesToDefaults(): Promise<PersonalRoutine[]> {
  const seed = deepCloneRoutines(PERSONAL_ROUTINES);
  await saveRoutines(seed);
  return seed;
}
