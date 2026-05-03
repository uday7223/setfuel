import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';

const log = logger.child({ module: 'sets' });

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
  const { userId } = res.locals;
  const { setId } = req.params;
  log.debug({ userId, setId }, 'Deleting set');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for set delete');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    let found = false;
    for (const ex of loaded.exercises) {
      const before = ex.sets.length;
      ex.sets = ex.sets.filter((s) => s.id !== setId);
      if (ex.sets.length < before) found = true;
    }
    if (!found) {
      log.warn({ userId, setId, sessionId: loaded.sessionId }, 'Set not found for deletion');
      res.status(404).json({ message: 'Set not found' });
      return;
    }
    await saveExercises(pool, loaded.sessionId, loaded.exercises);
    log.info({ userId, setId, sessionId: loaded.sessionId }, 'Set deleted');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, setId }, 'Failed to delete set');
    res.status(500).json({ message: 'Failed to delete set' });
  }
});

setsRouter.patch('/:setId', async (req, res) => {
  const { userId } = res.locals;
  const { setId } = req.params;
  log.debug({ userId, setId, body: req.body }, 'Updating set');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for set update');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    const hit = findSet(loaded.exercises, setId);
    if (!hit) {
      log.warn({ userId, setId, sessionId: loaded.sessionId }, 'Set not found for update');
      res.status(404).json({ message: 'Set not found' });
      return;
    }
    const { set } = hit;
    if (typeof req.body?.reps === 'string') set.reps = req.body.reps;
    if (typeof req.body?.weightKg === 'string') set.weightKg = req.body.weightKg;
    if (typeof req.body?.done === 'boolean') set.done = req.body.done;
    await saveExercises(pool, loaded.sessionId, loaded.exercises);
    log.debug({ userId, setId, sessionId: loaded.sessionId }, 'Set updated');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, setId }, 'Failed to update set');
    res.status(500).json({ message: 'Failed to update set' });
  }
});

setsRouter.post('/:setId/toggle', async (req, res) => {
  const { userId } = res.locals;
  const { setId } = req.params;
  log.debug({ userId, setId }, 'Toggling set done state');
  try {
    const pool = getPool()!;
    const loaded = await loadActiveSessionExercises(pool, userId);
    if (!loaded) {
      log.warn({ userId }, 'No active session for set toggle');
      res.status(404).json({ message: 'No active session' });
      return;
    }
    const hit = findSet(loaded.exercises, setId);
    if (!hit) {
      log.warn({ userId, setId, sessionId: loaded.sessionId }, 'Set not found for toggle');
      res.status(404).json({ message: 'Set not found' });
      return;
    }
    hit.set.done = !hit.set.done;
    await saveExercises(pool, loaded.sessionId, loaded.exercises);
    log.info(
      { userId, setId, done: hit.set.done, sessionId: loaded.sessionId },
      `Set toggled → done=${hit.set.done}`,
    );
    res.json({ done: hit.set.done });
  } catch (err) {
    log.error({ err, userId, setId }, 'Failed to toggle set');
    res.status(500).json({ message: 'Failed to toggle set' });
  }
});
