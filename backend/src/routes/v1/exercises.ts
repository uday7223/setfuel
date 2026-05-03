import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'exercises' });

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
  const { userId } = res.locals;
  const { exerciseId } = req.params;
  log.debug({ userId, exerciseId }, 'Deleting exercise');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for exercise delete');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    const next = loaded.exercises.filter((e) => e.id !== exerciseId);
    if (next.length === loaded.exercises.length) {
      log.warn({ userId, exerciseId, sessionId: loaded.sessionId }, 'Exercise not found for deletion');
      res.status(404).json({ message: 'Exercise not found' });
      return;
    }
    await saveExercises(pool, loaded.sessionId, next);
    log.info({ userId, exerciseId, sessionId: loaded.sessionId }, 'Exercise deleted');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, exerciseId }, 'Failed to delete exercise');
    res.status(500).json({ message: 'Failed to delete exercise' });
  }
});

exercisesRouter.patch('/:exerciseId', async (req, res) => {
  const { userId } = res.locals;
  const { exerciseId } = req.params;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    log.warn({ userId, exerciseId }, 'Rename exercise rejected — name is required');
    res.status(400).json({ message: 'name is required' });
    return;
  }
  log.debug({ userId, exerciseId, name }, 'Renaming exercise');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for exercise rename');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    const ex = loaded.exercises.find((e) => e.id === exerciseId);
    if (!ex) {
      log.warn({ userId, exerciseId, sessionId: loaded.sessionId }, 'Exercise not found for rename');
      res.status(404).json({ message: 'Exercise not found' });
      return;
    }
    ex.name = name;
    await saveExercises(pool, loaded.sessionId, loaded.exercises);
    log.info({ userId, exerciseId, name, sessionId: loaded.sessionId }, 'Exercise renamed');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, exerciseId }, 'Failed to rename exercise');
    res.status(500).json({ message: 'Failed to rename exercise' });
  }
});

exercisesRouter.post('/:exerciseId/sets', async (req, res) => {
  const { userId } = res.locals;
  const { exerciseId } = req.params;
  log.debug({ userId, exerciseId }, 'Adding set to exercise');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for adding set');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    const ex = loaded.exercises.find((e) => e.id === exerciseId);
    if (!ex) {
      log.warn({ userId, exerciseId, sessionId: loaded.sessionId }, 'Exercise not found for adding set');
      res.status(404).json({ message: 'Exercise not found' });
      return;
    }
    const set: SetEntry = { id: randomUUID(), reps: '10', weightKg: '', done: false };
    ex.sets.push(set);
    await saveExercises(pool, loaded.sessionId, loaded.exercises);
    log.info(
      { userId, exerciseId, setId: set.id, setCount: ex.sets.length, sessionId: loaded.sessionId },
      'Set added to exercise',
    );
    res.status(201).json(set);
  } catch (err) {
    log.error({ err, userId, exerciseId }, 'Failed to add set to exercise');
    res.status(500).json({ message: 'Failed to add set' });
  }
});
