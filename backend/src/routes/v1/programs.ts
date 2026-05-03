import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';

export const programsRouter = Router();

const log = logger.child({ module: 'programs' });

type RoutineBlock = { heading: string; items: string[] };

programsRouter.get('/', async (_req, res) => {
  const { userId } = res.locals;
  log.debug({ userId }, 'Listing programs');
  try {
    const pool = getPool()!;
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
    log.debug({ userId, count: list.length }, 'Programs listed');
    res.json(list);
  } catch (err) {
    log.error({ err, userId }, 'Failed to list programs');
    res.status(500).json({ message: 'Failed to list programs' });
  }
});

programsRouter.post('/', async (req, res) => {
  const { userId } = res.locals;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
  const dayLabel =
    typeof req.body?.dayLabel === 'string' && req.body.dayLabel.trim()
      ? req.body.dayLabel.trim()
      : null;

  if (!title) {
    log.warn({ userId }, 'Create program rejected — title is required');
    res.status(400).json({ message: 'title is required' });
    return;
  }

  log.debug({ userId, title, dayLabel }, 'Creating program');
  try {
    const pool = getPool()!;
    const id = randomUUID();
    await pool.query(
      `INSERT INTO workout_program (id, user_id, title, day_label, blocks)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [id, userId, title, dayLabel, JSON.stringify(blocks)],
    );
    log.info({ userId, programId: id, title }, 'Program created');
    res.status(201).json({ id, title, ...(dayLabel ? { dayLabel } : {}), blocks });
  } catch (err) {
    log.error({ err, userId, title }, 'Failed to create program');
    res.status(500).json({ message: 'Failed to create program' });
  }
});

programsRouter.put('/:id', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : [];
  const dayLabel =
    typeof req.body?.dayLabel === 'string' && req.body.dayLabel.trim()
      ? req.body.dayLabel.trim()
      : null;

  if (!title) {
    log.warn({ userId, programId: id }, 'Update program rejected — title is required');
    res.status(400).json({ message: 'title is required' });
    return;
  }

  log.debug({ userId, programId: id, title }, 'Updating program');
  try {
    const pool = getPool()!;
    const r = await pool.query(
      `UPDATE workout_program
       SET title = $3, day_label = $4, blocks = $5::jsonb, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [id, userId, title, dayLabel, JSON.stringify(blocks)],
    );
    if (r.rowCount === 0) {
      log.warn({ userId, programId: id }, 'Program not found for update');
      res.status(404).json({ message: 'Program not found' });
      return;
    }
    log.info({ userId, programId: id, title }, 'Program updated');
    res.json({ id, title, ...(dayLabel ? { dayLabel } : {}), blocks });
  } catch (err) {
    log.error({ err, userId, programId: id }, 'Failed to update program');
    res.status(500).json({ message: 'Failed to update program' });
  }
});

programsRouter.delete('/:id', async (req, res) => {
  const { userId } = res.locals;
  const { id } = req.params;
  log.debug({ userId, programId: id }, 'Deleting program');
  try {
    const pool = getPool()!;
    const r = await pool.query(
      'DELETE FROM workout_program WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (r.rowCount === 0) {
      log.warn({ userId, programId: id }, 'Program not found for deletion');
      res.status(404).json({ message: 'Program not found' });
      return;
    }
    log.info({ userId, programId: id }, 'Program deleted');
    res.status(204).send();
  } catch (err) {
    log.error({ err, userId, programId: id }, 'Failed to delete program');
    res.status(500).json({ message: 'Failed to delete program' });
  }
});
