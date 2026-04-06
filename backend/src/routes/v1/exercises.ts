import { randomUUID } from 'node:crypto';
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

export const exercisesRouter = Router();

exercisesRouter.delete('/:exerciseId', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  const next = loaded.exercises.filter((e) => e.id !== req.params.exerciseId);
  if (next.length === loaded.exercises.length) {
    res.status(404).json({ message: 'Exercise not found' });
    return;
  }
  await saveExercises(pool, loaded.sessionId, next);
  res.status(204).send();
});

exercisesRouter.patch('/:exerciseId', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ message: 'name is required' });
    return;
  }
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  const ex = loaded.exercises.find((e) => e.id === req.params.exerciseId);
  if (!ex) {
    res.status(404).json({ message: 'Exercise not found' });
    return;
  }
  ex.name = name;
  await saveExercises(pool, loaded.sessionId, loaded.exercises);
  res.status(204).send();
});

exercisesRouter.post('/:exerciseId/sets', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const loaded = await loadActiveSessionExercises(pool, userId);
  if (!loaded) {
    res.status(404).json({ message: 'No active session' });
    return;
  }
  const ex = loaded.exercises.find((e) => e.id === req.params.exerciseId);
  if (!ex) {
    res.status(404).json({ message: 'Exercise not found' });
    return;
  }
  const set: SetEntry = { id: randomUUID(), reps: '10', weightKg: '', done: false };
  ex.sets.push(set);
  await saveExercises(pool, loaded.sessionId, loaded.exercises);
  res.status(201).json(set);
});
