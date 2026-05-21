import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import { computeSessionStats, parseExercises } from '../../lib/workoutStats.js';
import { mapSession } from './sessionMappers.js';

export const historyRouter = Router();

const log = logger.child({ module: 'history' });

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDateParam(raw: unknown, name: string): string | null {
  if (typeof raw !== 'string' || !DATE_RE.test(raw)) return null;
  return raw;
}

/** GET /history/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD */
historyRouter.get('/calendar', async (req, res) => {
  const { userId } = res.locals;
  const from = parseDateParam(req.query.from, 'from');
  const to = parseDateParam(req.query.to, 'to');

  if (!from || !to) {
    res.status(400).json({ message: 'Query params from and to are required (YYYY-MM-DD)' });
    return;
  }

  log.debug({ userId, from, to }, 'Fetching history calendar');
  try {
    const pool = getPool()!;

    const workouts = await pool.query<{ day: string; count: string }>(
      `SELECT (COALESCE(ended_at, started_at) AT TIME ZONE 'UTC')::date::text AS day,
              COUNT(*)::text AS count
       FROM workout_session
       WHERE user_id = $1
         AND ended_at IS NOT NULL
         AND (ended_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
       GROUP BY day`,
      [userId, from, to],
    );

    const meals = await pool.query<{ day: string; count: string }>(
      `SELECT (created_at AT TIME ZONE 'UTC')::date::text AS day,
              COUNT(*)::text AS count
       FROM meal
       WHERE user_id = $1
         AND (created_at AT TIME ZONE 'UTC')::date BETWEEN $2::date AND $3::date
       GROUP BY day`,
      [userId, from, to],
    );

    const dayMap = new Map<
      string,
      { date: string; hasWorkout: boolean; hasMeals: boolean; sessionCount: number; mealCount: number }
    >();

    for (const row of workouts.rows) {
      dayMap.set(row.day, {
        date: row.day,
        hasWorkout: true,
        hasMeals: false,
        sessionCount: Number(row.count),
        mealCount: 0,
      });
    }

    for (const row of meals.rows) {
      const existing = dayMap.get(row.day);
      if (existing) {
        existing.hasMeals = true;
        existing.mealCount = Number(row.count);
      } else {
        dayMap.set(row.day, {
          date: row.day,
          hasWorkout: false,
          hasMeals: true,
          sessionCount: 0,
          mealCount: Number(row.count),
        });
      }
    }

    const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    res.json({ from, to, days });
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch history calendar');
    res.status(500).json({ message: 'Failed to fetch calendar' });
  }
});

/** GET /history/day?date=YYYY-MM-DD */
historyRouter.get('/day', async (req, res) => {
  const { userId } = res.locals;
  const date = parseDateParam(req.query.date, 'date');

  if (!date) {
    res.status(400).json({ message: 'Query param date is required (YYYY-MM-DD)' });
    return;
  }

  log.debug({ userId, date }, 'Fetching history day detail');
  try {
    const pool = getPool()!;

    const sessionsR = await pool.query<{
      id: string;
      started_at: Date;
      ended_at: Date | null;
      exercises: unknown;
    }>(
      `SELECT id, started_at, ended_at, exercises
       FROM workout_session
       WHERE user_id = $1
         AND ended_at IS NOT NULL
         AND (ended_at AT TIME ZONE 'UTC')::date = $2::date
       ORDER BY ended_at DESC`,
      [userId, date],
    );

    const mealsR = await pool.query<{
      id: string;
      name: string;
      kcal: number;
      time_display: string;
      created_at: Date;
      image_uri: string | null;
      protein: number | null;
      carbs: number | null;
      fats: number | null;
    }>(
      `SELECT id, name, kcal, time_display, created_at, image_uri, protein, carbs, fats
       FROM meal
       WHERE user_id = $1
         AND (created_at AT TIME ZONE 'UTC')::date = $2::date
       ORDER BY created_at ASC`,
      [userId, date],
    );

    const u = await pool.query<{ goal_kcal: number }>(
      'SELECT goal_kcal FROM app_user WHERE id = $1',
      [userId],
    );
    const goalKcal = u.rows[0]?.goal_kcal ?? 2500;

    const sessions = sessionsR.rows.map((row) => {
      const exercises = parseExercises(row.exercises);
      const session = mapSession(row);
      const stats = computeSessionStats(exercises, row.started_at, row.ended_at);
      return { ...session, stats };
    });

    const meals = mealsR.rows.map((row) => ({
      id: row.id,
      name: row.name,
      kcal: row.kcal,
      time: row.time_display,
      createdAt: new Date(row.created_at).toISOString(),
      ...(row.image_uri ? { imageUri: row.image_uri } : {}),
      ...(row.protein != null && row.carbs != null && row.fats != null
        ? { macros: { protein: row.protein, carbs: row.carbs, fats: row.fats } }
        : {}),
    }));

    const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);
    const macros = meals.reduce(
      (acc, m) => ({
        protein: acc.protein + (m.macros?.protein ?? 0),
        carbs: acc.carbs + (m.macros?.carbs ?? 0),
        fats: acc.fats + (m.macros?.fats ?? 0),
      }),
      { protein: 0, carbs: 0, fats: 0 },
    );

    res.json({
      date,
      sessions,
      meals,
      dietSummary: {
        totalKcal,
        goalKcal,
        mealsLogged: meals.length,
        macros,
        nutritionProgress: goalKcal > 0 ? Math.min(1, totalKcal / goalKcal) : 0,
      },
    });
  } catch (err) {
    log.error({ err, userId, date }, 'Failed to fetch history day');
    res.status(500).json({ message: 'Failed to fetch day detail' });
  }
});
