import type { ExerciseEntry } from '../../lib/workoutStats.js';

export function mapSession(row: {
  id: string;
  started_at: Date;
  ended_at: Date | null;
  exercises: unknown;
}): {
  id: string;
  startedAt: string;
  endedAt?: string;
  exercises: ExerciseEntry[];
} {
  const exercises = Array.isArray(row.exercises) ? (row.exercises as ExerciseEntry[]) : [];
  return {
    id: row.id,
    startedAt: new Date(row.started_at).toISOString(),
    ...(row.ended_at ? { endedAt: new Date(row.ended_at).toISOString() } : {}),
    exercises,
  };
}
