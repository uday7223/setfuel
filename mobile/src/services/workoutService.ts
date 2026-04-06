/**
 * Workout service — async operations backed by local state.
 *
 * To switch to live API:
 *   Replace function bodies with apiFetch() calls.
 *   Types and signatures stay identical.
 */

import type { ExerciseEntry, PersonalRoutine, SetEntry, WorkoutSession } from '../types';
import { apiFetch, localId, USE_LOCAL } from './api';

/* ── Local state (simulates server persistence) ────────────── */

let _activeSession: WorkoutSession | null = null;

/* ── Programs / Routines ───────────────────────────────────── */

export async function getPrograms(): Promise<PersonalRoutine[]> {
  if (USE_LOCAL) {
    const { PERSONAL_ROUTINES } = await import('../data/personalRoutines');
    return PERSONAL_ROUTINES;
  }
  return apiFetch<PersonalRoutine[]>('/programs');
}

/* ── Session lifecycle ─────────────────────────────────────── */

export async function startSession(): Promise<WorkoutSession> {
  const session: WorkoutSession = {
    id: localId(),
    startedAt: new Date().toISOString(),
    exercises: [],
  };
  if (USE_LOCAL) {
    _activeSession = session;
    return session;
  }
  return apiFetch<WorkoutSession>('/sessions', { method: 'POST' });
}

export async function getActiveSession(): Promise<WorkoutSession | null> {
  if (USE_LOCAL) return _activeSession;
  return apiFetch<WorkoutSession | null>('/sessions/active');
}

export async function endSession(): Promise<WorkoutSession | null> {
  if (USE_LOCAL) {
    if (!_activeSession) return null;
    _activeSession.endedAt = new Date().toISOString();
    const finished = { ..._activeSession };
    _activeSession = null;
    return finished;
  }
  const active = await getActiveSession();
  if (!active) return null;
  return apiFetch<WorkoutSession>(`/sessions/${active.id}/end`, { method: 'POST' });
}

/* ── Exercise CRUD (within active session) ─────────────────── */

export async function addExercise(name: string): Promise<ExerciseEntry> {
  const exercise: ExerciseEntry = {
    id: localId(),
    name: name.trim() || 'Exercise',
    sets: [{ id: localId(), reps: '10', weightKg: '', done: false }],
  };
  if (USE_LOCAL && _activeSession) {
    _activeSession.exercises.push(exercise);
    return exercise;
  }
  if (!USE_LOCAL) {
    const active = await getActiveSession();
    if (!active) {
      throw new Error('No active workout session');
    }
    return apiFetch<ExerciseEntry>(`/sessions/${active.id}/exercises`, {
      method: 'POST',
      body: { name: exercise.name },
    });
  }
  return exercise;
}

export async function removeExercise(exerciseId: string): Promise<void> {
  if (USE_LOCAL && _activeSession) {
    _activeSession.exercises = _activeSession.exercises.filter((e) => e.id !== exerciseId);
    return;
  }
  if (!USE_LOCAL) {
    await apiFetch<void>(`/exercises/${exerciseId}`, { method: 'DELETE' });
  }
}

export async function updateExerciseName(exerciseId: string, name: string): Promise<void> {
  if (USE_LOCAL && _activeSession) {
    const ex = _activeSession.exercises.find((e) => e.id === exerciseId);
    if (ex) ex.name = name;
    return;
  }
  if (!USE_LOCAL) {
    await apiFetch<void>(`/exercises/${exerciseId}`, { method: 'PATCH', body: { name } });
  }
}

/* ── Set CRUD (within an exercise) ─────────────────────────── */

export async function addSet(exerciseId: string): Promise<SetEntry> {
  const set: SetEntry = { id: localId(), reps: '10', weightKg: '', done: false };
  if (USE_LOCAL && _activeSession) {
    const ex = _activeSession.exercises.find((e) => e.id === exerciseId);
    if (ex) ex.sets.push(set);
    return set;
  }
  if (!USE_LOCAL) {
    return apiFetch<SetEntry>(`/exercises/${exerciseId}/sets`, { method: 'POST' });
  }
  return set;
}

export async function removeSet(exerciseId: string, setId: string): Promise<void> {
  if (USE_LOCAL && _activeSession) {
    const ex = _activeSession.exercises.find((e) => e.id === exerciseId);
    if (ex) ex.sets = ex.sets.filter((s) => s.id !== setId);
    return;
  }
  if (!USE_LOCAL) {
    await apiFetch<void>(`/sets/${setId}`, { method: 'DELETE' });
  }
}

export async function updateSet(
  exerciseId: string,
  setId: string,
  field: 'reps' | 'weightKg' | 'done',
  value: string | boolean,
): Promise<void> {
  if (USE_LOCAL && _activeSession) {
    const ex = _activeSession.exercises.find((e) => e.id === exerciseId);
    const set = ex?.sets.find((s) => s.id === setId);
    if (set) {
      (set as Record<string, unknown>)[field] = value;
    }
    return;
  }
  if (!USE_LOCAL) {
    await apiFetch<void>(`/sets/${setId}`, { method: 'PATCH', body: { [field]: value } });
  }
}

export async function toggleSetDone(exerciseId: string, setId: string): Promise<boolean> {
  if (USE_LOCAL && _activeSession) {
    const ex = _activeSession.exercises.find((e) => e.id === exerciseId);
    const set = ex?.sets.find((s) => s.id === setId);
    if (set) set.done = !set.done;
    return set?.done ?? false;
  }
  if (!USE_LOCAL) {
    const res = await apiFetch<{ done: boolean }>(`/sets/${setId}/toggle`, { method: 'POST' });
    return res.done;
  }
  return false;
}
