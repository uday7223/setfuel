import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { getClientTimeZone, getClientTimeZoneParam, getLocalDateExpr } from '../../lib/clientTimeZone.js';
import { logger } from '../../lib/logger.js';
import { computeSessionStats, parseExercises, type ExerciseEntry } from '../../lib/workoutStats.js';
import { mapSession } from './sessionMappers.js';

const log = logger.child({ module: 'sessions' });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const sessionsRouter = Router();

/** GET /sessions?from=YYYY-MM-DD&to=YYYY-MM-DD — completed sessions in range (summary + stats). */
sessionsRouter.get('/', async (req, res) => {
  const { userId } = res.locals;
  const from = typeof req.query.from === 'string' && DATE_RE.test(req.query.from) ? req.query.from : null;
  const to = typeof req.query.to === 'string' && DATE_RE.test(req.query.to) ? req.query.to : null;

  if (!from || !to) {
    res.status(400).json({ message: 'Query params from and to are required (YYYY-MM-DD)' });
    return;
  }

  log.debug({ userId, from, to }, 'Listing workout sessions');
  try {
    const pool = getPool()!;
    const timeZone = getClientTimeZone(req);
    const workoutDayExpr = getLocalDateExpr('ended_at', timeZone, 4);
    const r = await pool.query<{
      id: string;
      started_at: Date;
      ended_at: Date | null;
      exercises: unknown;
    }>(
      `SELECT id, started_at, ended_at, exercises
       FROM workout_session
       WHERE user_id = $1
         AND ended_at IS NOT NULL
         AND ${workoutDayExpr} BETWEEN $2::date AND $3::date
       ORDER BY ended_at DESC`,
      [userId, from, to, getClientTimeZoneParam(timeZone)],
    );

    const list = r.rows.map((row) => {
      const exercises = parseExercises(row.exercises);
      const session = mapSession(row);
      const stats = computeSessionStats(exercises, row.started_at, row.ended_at);
      return { ...session, stats };
    });

    res.json(list);
  } catch (err) {
    log.error({ err, userId }, 'Failed to list sessions');
    res.status(500).json({ message: 'Failed to list sessions' });
  }
});

sessionsRouter.get('/active', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Fetching active session');
  try {
    const pool = getPool()!;
    const r = await pool.query(
      `SELECT id, started_at, ended_at, exercises
       FROM workout_session
       WHERE user_id = $1 AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`,
      [userId],
    );
    const row = r.rows[0];
    if (row) {
      log.debug({ userId, sessionId: row.id }, 'Active session found');
    } else {
      log.debug({ userId }, 'No active session');
    }
    res.json(row ? mapSession(row) : null);
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch active session');
    res.status(500).json({ message: 'Failed to fetch active session' });
  }
});

sessionsRouter.post('/', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Starting new workout session');
  try {
    const pool = getPool()!;

    // Close any lingering open session
    const closed = await pool.query(
      `UPDATE workout_session SET ended_at = now()
       WHERE user_id = $1 AND ended_at IS NULL
       RETURNING id`,
      [userId],
    );
    if (closed.rowCount && closed.rowCount > 0) {
      log.info({ userId, closedSessionId: closed.rows[0]?.id }, 'Auto-closed previous open session');
    }

    const id = randomUUID();
    const startedAt = new Date();
    await pool.query(
      `INSERT INTO workout_session (id, user_id, started_at, exercises)
       VALUES ($1, $2, $3, '[]'::jsonb)`,
      [id, userId, startedAt],
    );
    log.info({ userId, sessionId: id }, 'Workout session started');
    res.status(201).json({ id, startedAt: startedAt.toISOString(), exercises: [] });
  } catch (err) {
    log.error({ err, userId }, 'Failed to start workout session');
    res.status(500).json({ message: 'Failed to start session' });
  }
});

sessionsRouter.post('/:id/end', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;
  log.debug({ userId, sessionId: id }, 'Ending workout session');
  try {
    const pool = getPool()!;
    const r = await pool.query(
      `UPDATE workout_session
       SET ended_at = now()
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
       RETURNING id, started_at, ended_at, exercises`,
      [id, userId],
    );
    const row = r.rows[0];
    if (!row) {
      log.warn({ userId, sessionId: id }, 'Active session not found to end');
      res.status(404).json({ message: 'Active session not found' });
      return;
    }
    const session = mapSession(row);
    const durationMs =
      new Date(session.endedAt!).getTime() - new Date(session.startedAt).getTime();
    log.info(
      { userId, sessionId: id, durationMs, exerciseCount: session.exercises.length },
      'Workout session ended',
    );
    res.json(session);
  } catch (err) {
    log.error({ err, userId, sessionId: id }, 'Failed to end workout session');
    res.status(500).json({ message: 'Failed to end session' });
  }
});

sessionsRouter.post('/:id/exercises', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;
  const name =
    typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Exercise';
  log.debug({ userId, sessionId: id, name }, 'Adding exercise to session');
  try {
    const pool = getPool()!;
    const r = await pool.query<{ exercises: unknown }>(
      `SELECT exercises FROM workout_session
       WHERE id = $1 AND user_id = $2 AND ended_at IS NULL`,
      [id, userId],
    );
    const row = r.rows[0];
    if (!row) {
      log.warn({ userId, sessionId: id }, 'Active session not found for adding exercise');
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
      id,
    ]);
    log.info({ userId, sessionId: id, exerciseId: exercise.id, name }, 'Exercise added to session');
    res.status(201).json(exercise);
  } catch (err) {
    log.error({ err, userId, sessionId: id }, 'Failed to add exercise to session');
    res.status(500).json({ message: 'Failed to add exercise' });
  }
});

/** GET /sessions/:id — session detail (active or completed) with stats. */
sessionsRouter.get('/:id', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;

  log.debug({ userId, sessionId: id }, 'Fetching session by id');
  try {
    const pool = getPool()!;
    const r = await pool.query<{
      id: string;
      started_at: Date;
      ended_at: Date | null;
      exercises: unknown;
    }>(
      `SELECT id, started_at, ended_at, exercises
       FROM workout_session
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = r.rows[0];
    if (!row) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }
    const exercises = parseExercises(row.exercises);
    const session = mapSession(row);
    const stats = computeSessionStats(exercises, row.started_at, row.ended_at);
    res.json({ ...session, stats });
  } catch (err) {
    log.error({ err, userId, sessionId: id }, 'Failed to fetch session');
    res.status(500).json({ message: 'Failed to fetch session' });
  }
});
