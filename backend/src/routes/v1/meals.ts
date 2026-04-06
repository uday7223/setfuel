import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { formatMealTime } from '../../lib/mealDisplay.js';

export const mealsRouter = Router();

mealsRouter.get('/daily-summary', async (_req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;

  const u = await pool.query<{ goal_kcal: number }>('SELECT goal_kcal FROM app_user WHERE id = $1', [
    userId,
  ]);
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
       AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date`,
    [userId],
  );
  const row = r.rows[0];
  res.json({
    totalKcal: Number(row?.total ?? 0),
    goalKcal,
    macros: {
      protein: Number(row?.p ?? 0),
      carbs: Number(row?.c ?? 0),
      fats: Number(row?.f ?? 0),
    },
    mealsLogged: Number(row?.count ?? 0),
  });
});

mealsRouter.get('/', async (_req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
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
  res.json(list);
});

mealsRouter.post('/', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const kcal = Number(req.body?.kcal);
  if (!name || !Number.isFinite(kcal)) {
    res.status(400).json({ message: 'name and numeric kcal are required' });
    return;
  }
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
});

mealsRouter.delete('/:id', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const r = await pool.query('DELETE FROM meal WHERE id = $1 AND user_id = $2', [
    req.params.id,
    userId,
  ]);
  if (r.rowCount === 0) {
    res.status(404).json({ message: 'Meal not found' });
    return;
  }
  res.status(204).send();
});
