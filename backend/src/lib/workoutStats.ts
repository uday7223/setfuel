export type SetEntry = { id: string; reps: string; weightKg: string; done: boolean };
export type ExerciseEntry = { id: string; name: string; sets: SetEntry[] };

export type SessionStats = {
  exerciseCount: number;
  setCount: number;
  setsCompleted: number;
  volumeKg: number;
  durationMs: number | null;
  durationMinutes: number | null;
};

export function parseExercises(raw: unknown): ExerciseEntry[] {
  return Array.isArray(raw) ? (raw as ExerciseEntry[]) : [];
}

/** Volume = sum(weightKg × reps) for sets marked done (missing values treated as 0). */
export function computeSessionStats(
  exercises: ExerciseEntry[],
  startedAt: string | Date,
  endedAt?: string | Date | null,
): SessionStats {
  let setCount = 0;
  let setsCompleted = 0;
  let volumeKg = 0;

  for (const ex of exercises) {
    for (const s of ex.sets) {
      setCount += 1;
      if (s.done) {
        setsCompleted += 1;
        const w = Number.parseFloat(s.weightKg) || 0;
        const r = Number.parseInt(s.reps, 10) || 0;
        volumeKg += w * r;
      }
    }
  }

  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt != null ? new Date(endedAt).getTime() : NaN;
  const durationMs = Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : null;

  return {
    exerciseCount: exercises.length,
    setCount,
    setsCompleted,
    volumeKg: Math.round(volumeKg * 10) / 10,
    durationMs,
    durationMinutes: durationMs != null ? Math.max(1, Math.round(durationMs / 60_000)) : null,
  };
}
