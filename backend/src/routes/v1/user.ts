import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';

export const userRouter = Router();

const log = logger.child({ module: 'user' });

userRouter.get('/profile', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Fetching user profile');
  try {
    const pool = getPool()!;
    const r = await pool.query<{
      id: string;
      display_name: string;
      email: string;
      avatar_uri: string | null;
    }>('SELECT id::text, display_name, email, avatar_uri FROM app_user WHERE id = $1', [userId]);
    const row = r.rows[0];
    if (!row) {
      log.warn({ userId }, 'User profile not found');
      res.status(404).json({ message: 'User not found' });
      return;
    }
    log.debug({ userId, email: row.email }, 'Profile fetched');
    res.json({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      ...(row.avatar_uri ? { avatarUri: row.avatar_uri } : {}),
    });
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch user profile');
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

userRouter.get('/dashboard-summary', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Fetching dashboard summary');
  try {
    const pool = getPool()!;

    const u = await pool.query<{ goal_kcal: number }>(
      'SELECT goal_kcal FROM app_user WHERE id = $1',
      [userId],
    );
    const goalKcal = u.rows[0]?.goal_kcal ?? 2500;

    const mealsToday = await pool.query<{ total: string; count: string }>(
      `SELECT COALESCE(SUM(kcal), 0)::text AS total, COUNT(*)::text AS count
       FROM meal
       WHERE user_id = $1 AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date`,
      [userId],
    );
    const todayKcal = Number(mealsToday.rows[0]?.total ?? 0);

    const macrosRow = await pool.query<{ p: string; c: string; f: string }>(
      `SELECT
         COALESCE(SUM(protein), 0)::text AS p,
         COALESCE(SUM(carbs), 0)::text AS c,
         COALESCE(SUM(fats), 0)::text AS f
       FROM meal
       WHERE user_id = $1
         AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date`,
      [userId],
    );
    const m = macrosRow.rows[0];
    const macros = {
      protein: Number(m?.p ?? 0),
      carbs: Number(m?.c ?? 0),
      fats: Number(m?.f ?? 0),
    };

    const last = await pool.query<{ ended_at: Date }>(
      `SELECT ended_at FROM workout_session
       WHERE user_id = $1 AND ended_at IS NOT NULL
       ORDER BY ended_at DESC
       LIMIT 1`,
      [userId],
    );
    const ended = last.rows[0]?.ended_at;
    const lastWorkoutDaysAgo = ended
      ? Math.max(0, Math.floor((Date.now() - new Date(ended).getTime()) / 86_400_000))
      : 0;

    const nutritionProgress = goalKcal > 0 ? Math.min(1, todayKcal / goalKcal) : 0;

    log.debug(
      { userId, todayKcal, goalKcal, lastWorkoutDaysAgo, nutritionProgress },
      'Dashboard summary fetched',
    );
    res.json({ lastWorkoutDaysAgo, todayKcal, goalKcal, nutritionProgress, macros });
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch dashboard summary');
    res.status(500).json({ message: 'Failed to fetch dashboard summary' });
  }
});
