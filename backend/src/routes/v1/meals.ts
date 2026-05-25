import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getClientTimeZone, getClientTimeZoneParam, getLocalDateExpr } from '../../lib/clientTimeZone.js';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import { formatMealTime } from '../../lib/mealDisplay.js';

export const mealsRouter = Router();

const log = logger.child({ module: 'meals' });

mealsRouter.get('/daily-summary', async (req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Fetching daily meal summary');
  try {
    const pool = getPool()!;
    const timeZone = getClientTimeZone(req);
    const mealDayExpr = getLocalDateExpr('created_at', timeZone, 2);
    const todayExpr = getLocalDateExpr('now()', timeZone, 2);

    const u = await pool.query<{ goal_kcal: number }>(
      'SELECT goal_kcal FROM app_user WHERE id = $1',
      [userId],
    );
    const goalKcal = u.rows[0]?.goal_kcal ?? 2500;

    const r = await pool.query<{ total: string; count: string; p: string; c: string; f: string }>(
      `SELECT
         COALESCE(SUM(kcal), 0)::text AS total,
         COUNT(*)::text AS count,
         COALESCE(SUM(protein), 0)::text AS p,
         COALESCE(SUM(carbs), 0)::text AS c,
         COALESCE(SUM(fats), 0)::text AS f
       FROM meal
       WHERE user_id = $1
         AND ${mealDayExpr} = ${todayExpr}`,
      [userId, getClientTimeZoneParam(timeZone)],
    );
    const row = r.rows[0];
    const totalKcal = Number(row?.total ?? 0);
    const mealsLogged = Number(row?.count ?? 0);
    log.debug({ userId, totalKcal, goalKcal, mealsLogged }, 'Daily summary fetched');
    res.json({
      totalKcal,
      goalKcal,
      macros: {
        protein: Number(row?.p ?? 0),
        carbs: Number(row?.c ?? 0),
        fats: Number(row?.f ?? 0),
      },
      mealsLogged,
    });
  } catch (err) {
    log.error({ err, userId }, 'Failed to fetch daily meal summary');
    res.status(500).json({ message: 'Failed to fetch daily summary' });
  }
});

mealsRouter.get('/', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Listing meals');
  try {
    const pool = getPool()!;
    const r = await pool.query(
      `SELECT id, name, kcal, time_display, created_at, image_uri, protein, carbs, fats
       FROM meal
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );
    const list = r.rows.map((row) => ({
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
    log.debug({ userId, count: list.length }, 'Meals listed');
    res.json(list);
  } catch (err) {
    log.error({ err, userId }, 'Failed to list meals');
    res.status(500).json({ message: 'Failed to list meals' });
  }
});

mealsRouter.post('/', async (req, res) => {
  const { userId } = res.locals;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const kcal = Number(req.body?.kcal);

  if (!name || !Number.isFinite(kcal)) {
    log.warn({ userId, name, kcal }, 'Log meal rejected — name and numeric kcal required');
    res.status(400).json({ message: 'name and numeric kcal are required' });
    return;
  }

  log.debug({ userId, name, kcal }, 'Logging meal');
  try {
    const pool = getPool()!;
    const imageUri = typeof req.body?.imageUri === 'string' ? req.body.imageUri : null;
    const macros = req.body?.macros as { protein?: number; carbs?: number; fats?: number } | undefined;
    const protein = macros && typeof macros.protein === 'number' ? macros.protein : null;
    const carbs = macros && typeof macros.carbs === 'number' ? macros.carbs : null;
    const fats = macros && typeof macros.fats === 'number' ? macros.fats : null;
    const id = randomUUID();
    const createdAt = new Date();
    const timeDisplay = formatMealTime(createdAt);

    await pool.query(
      `INSERT INTO meal (id, user_id, name, kcal, time_display, created_at, image_uri, protein, carbs, fats)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, userId, name, kcal, timeDisplay, createdAt, imageUri, protein, carbs, fats],
    );

    log.info(
      { userId, mealId: id, name, kcal, hasMacros: protein != null },
      'Meal logged',
    );
    res.status(201).json({
      id,
      name,
      kcal,
      time: timeDisplay,
      createdAt: createdAt.toISOString(),
      ...(imageUri ? { imageUri } : {}),
      ...(protein != null && carbs != null && fats != null
        ? { macros: { protein, carbs, fats } }
        : {}),
    });
  } catch (err) {
    log.error({ err, userId, name, kcal }, 'Failed to log meal');
    res.status(500).json({ message: 'Failed to log meal' });
  }
});

mealsRouter.delete('/:id', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;
  log.debug({ userId, mealId: id }, 'Deleting meal');
  try {
    const pool = getPool()!;
    const r = await pool.query('DELETE FROM meal WHERE id = $1 AND user_id = $2', [id, userId]);
    if (r.rowCount === 0) {
      log.warn({ userId, mealId: id }, 'Meal not found for deletion');
      res.status(404).json({ message: 'Meal not found' });
      return;
    }
    log.info({ userId, mealId: id }, 'Meal deleted');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, mealId: id }, 'Failed to delete meal');
    res.status(500).json({ message: 'Failed to delete meal' });
  }
});
