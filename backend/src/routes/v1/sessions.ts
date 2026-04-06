import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';

type SetEntry = { id: string; reps: string; weightKg: string; done: boolean };
type ExerciseEntry = { id: string; name: string; sets: SetEntry[] };

function mapSession(row: {
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

export const sessionsRouter = Router();

sessionsRouter.get('/active', async (_req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const r = await pool.query(
    `SELECT id, started_at, ended_at, exercises
     FROM workout_session
     WHERE user_id = $1 AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = r.rows[0];
  res.json(row ? mapSession(row) : null);
});

sessionsRouter.post('/', async (_req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  await pool.query(
    `UPDATE workout_session SET ended_at = now()
     WHERE user_id = $1 AND ended_at IS NULL`,
    [userId],
  );
  const id = randomUUID();
  const startedAt = new Date();
  await pool.query(
    `INSERT INTO workout_session (id, user_id, started_at, exercises)
     VALUES ($1, $2, $3, '[]'::jsonb)`,
    [id, userId, startedAt],
  );
  res.status(201).json({
    id,
    startedAt: startedAt.toISOString(),
    exercises: [],
  });
});

sessionsRouter.post('/:id/end', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const r = await pool.query(
    `UPDATE workout_session
     SET ended_at = now()
     WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
     RETURNING id, started_at, ended_at, exercises`,
    [req.params.id, userId],
  );
  const row = r.rows[0];
  if (!row) {
    res.status(404).json({ message: 'Active session not found' });
    return;
  }
  res.json(mapSession(row));
});

sessionsRouter.post('/:id/exercises', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const name =
    typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Exercise';
  const r = await pool.query<{ exercises: unknown }>(
    `SELECT exercises FROM workout_session
     WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
    [req.params.id, userId],
  );
  const row = r.rows[0];
  if (!row) {
    res.status(404).json({ message: 'Active session not found' });
    return;
  }
  const exercises = Array.isArray(row.exercises) ? ([...row.exercises] as ExerciseEntry[]) : [];
  const exercise: ExerciseEntry = {
    id: randomUUID(),
    name,
    sets: [{ id: randomUUID(), reps: '10', weightKg: '', done: false }],
  };
  exercises.push(exercise);
  await pool.query(`UPDATE workout_session SET exercises = $1::jsonb WHERE id = $2`, [
    JSON.stringify(exercises),
    req.params.id,
  ]);
  res.status(201).json(exercise);
});
