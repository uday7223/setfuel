import { Router } from 'express';
import { getPool } from '../../db/pool.js';

type SetEntry = { id: string; reps: string; weightKg: string; done: boolean };
type ExerciseEntry = { id: string; name: string; sets: SetEntry[] };

async function loadActiveSessionExercises(
  pool: ReturnType<typeof getPool>,
  userId: number,
): Promise<{ sessionId: string; exercises: ExerciseEntry[] } | null> {
  const r = await pool!.query<{ id: string; exercises: unknown }>(
    `SELECT id, exercises FROM workout_session
     WHERE user_id = $1 AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    sessionId: row.id,
    exercises: Array.isArray(row.exercises) ? (row.exercises as ExerciseEntry[]) : [],
  };
}

async function saveExercises(
  pool: NonNullable<ReturnType<typeof getPool>>,
  sessionId: string,
  exercises: ExerciseEntry[],
) {
  await pool.query(`UPDATE workout_session SET exercises = $1::jsonb WHERE id = $2`, [
    JSON.stringify(exercises),
    sessionId,
  ]);
}

function findSet(
  exercises: ExerciseEntry[],
  setId: string,
): { exercise: ExerciseEntry; set: SetEntry } | null {
  for (const exercise of exercises) {
    const set = exercise.sets.find((s) => s.id === setId);
    if (set) return { exercise, set };
  }
  return null;
}

export const setsRouter = Router();

setsRouter.delete('/:setId', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  let found = false;
  for (const ex of loaded.exercises) {
    const before = ex.sets.length;
    ex.sets = ex.sets.filter((s) => s.id !== req.params.setId);
    if (ex.sets.length < before) found = true;
  }
  if (!found) {
    res.status(404).json({ message: 'Set not found' });
    return;
  }
  await saveExercises(pool, loaded.sessionId, loaded.exercises);
  res.status(204).send();
});

setsRouter.patch('/:setId', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  const hit = findSet(loaded.exercises, req.params.setId);
  if (!hit) {
    res.status(404).json({ message: 'Set not found' });
    return;
  }
  const { set } = hit;
  if (typeof req.body?.reps === 'string') set.reps = req.body.reps;
  if (typeof req.body?.weightKg === 'string') set.weightKg = req.body.weightKg;
  if (typeof req.body?.done === 'boolean') set.done = req.body.done;
  await saveExercises(pool, loaded.sessionId, loaded.exercises);
  res.status(204).send();
});

setsRouter.post('/:setId/toggle', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  const hit = findSet(loaded.exercises, req.params.setId);
  if (!hit) {
    res.status(404).json({ message: 'Set not found' });
    return;
  }
  hit.set.done = !hit.set.done;
  await saveExercises(pool, loaded.sessionId, loaded.exercises);
  res.json({ done: hit.set.done });
});
