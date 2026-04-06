import type { NextFunction, Request, Response } from 'express';
import { getPool } from '../db/pool.js';

/**
 * Uses the first row in `app_user` (seed `dev@local.test` after migrations).
 * Replace with JWT → user id when you add auth.
 */
export async function requireUser(_req: Request, res: Response, next: NextFunction) {
  const pool = getPool();
  if (!pool) {
    res.status(503).json({ message: 'Database unavailable' });
    return;
  }
  try {
    const r = await pool.query<{ id: string }>(
      'SELECT id::text AS id FROM app_user ORDER BY id ASC LIMIT 1',
    );
    const row = r.rows[0];
    if (!row) {
      res.status(503).json({ message: 'No app_user row — run npm run db:migrate' });
      return;
    }
    res.locals.userId = Number(row.id);
    next();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'query failed';
    res.status(500).json({ message: msg });
  }
}
