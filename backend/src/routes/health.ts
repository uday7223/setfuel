import { Router } from 'express';
import { getPool } from '../db/pool.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, service: 'setfuel-api' });
});

healthRouter.get('/db', async (_req, res) => {
  const pool = getPool();
  if (!pool) {
    res.status(503).json({ ok: false, error: 'DATABASE_URL not configured' });
    return;
  }
  try {
    const r = await pool.query('SELECT 1 AS one');
    res.json({ ok: true, db: r.rows[0]?.one === 1 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    res.status(503).json({ ok: false, error: message });
  }
});
