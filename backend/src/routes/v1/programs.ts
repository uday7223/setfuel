import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';

export const programsRouter = Router();

type RoutineBlock = { heading: string; items: string[] };

programsRouter.get('/', async (_req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const r = await pool.query<{
    id: string;
    title: string;
    day_label: string | null;
    blocks: unknown;
  }>(
    `SELECT id, title, day_label, blocks
     FROM workout_program
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId],
  );
  const list = r.rows.map((row) => ({
    id: row.id,
    title: row.title,
    ...(row.day_label ? { dayLabel: row.day_label } : {}),
    blocks: Array.isArray(row.blocks) ? (row.blocks as RoutineBlock[]) : [],
  }));
  res.json(list);
});

programsRouter.post('/', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
  const dayLabel =
    typeof req.body?.dayLabel === 'string' && req.body.dayLabel.trim()
      ? req.body.dayLabel.trim()
      : null;
  if (!title) {
    res.status(400).json({ message: 'title is required' });
    return;
  }
  const id = randomUUID();
  await pool.query(
    `INSERT INTO workout_program (id, user_id, title, day_label, blocks)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [id, userId, title, dayLabel, JSON.stringify(blocks)],
  );
  res.status(201).json({
    id,
    title,
    ...(dayLabel ? { dayLabel } : {}),
    blocks,
  });
});

programsRouter.put('/:id', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const { id } = req.params;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
  const dayLabel =
    typeof req.body?.dayLabel === 'string' && req.body.dayLabel.trim()
      ? req.body.dayLabel.trim()
      : null;
  if (!title) {
    res.status(400).json({ message: 'title is required' });
    return;
  }
  const r = await pool.query(
    `UPDATE workout_program
     SET title = $3, day_label = $4, blocks = $5::jsonb, updated_at = now()
     WHERE id = $1 AND user_id = $2`,
    [id, userId, title, dayLabel, JSON.stringify(blocks)],
  );
  if (r.rowCount === 0) {
    res.status(404).json({ message: 'Program not found' });
    return;
  }
  res.json({
    id,
    title,
    ...(dayLabel ? { dayLabel } : {}),
    blocks,
  });
});

programsRouter.delete('/:id', async (req, res) => {
  const pool = getPool()!;
  const { userId } = res.locals;
  const r = await pool.query('DELETE FROM workout_program WHERE id = $1 AND user_id = $2', [
    req.params.id,
    userId,
  ]);
  if (r.rowCount === 0) {
    res.status(404).json({ message: 'Program not found' });
    return;
  }
  res.status(204).send();
});
