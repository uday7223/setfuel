import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const { Pool } = pg;

const log = logger.child({ module: 'db' });

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!config.databaseUrl) {
    log.warn('DATABASE_URL is not set — all DB operations will fail');
    return null;
  }

  if (!pool) {
    pool = new Pool({ connectionString: config.databaseUrl });
    log.info('PostgreSQL connection pool created');

    pool.on('connect', () => {
      log.debug('New DB client connected');
    });

    pool.on('remove', () => {
      log.debug('DB client removed from pool');
    });

    pool.on('error', (err: Error) => {
      log.error({ err }, 'Idle DB client error');
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    log.info('Draining PostgreSQL connection pool…');
    await pool.end();
    pool = null;
    log.info('PostgreSQL connection pool closed');
  }
}
