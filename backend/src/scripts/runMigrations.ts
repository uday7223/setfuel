/**
 * Runs every `sql/*.sql` file in alphabetical order (001, 002, …).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const dir = join(process.cwd(), 'sql');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const pool = new pg.Pool({ connectionString: url });
try {
  for (const f of files) {
    const sql = readFileSync(join(dir, f), 'utf8');
    await pool.query(sql);
    console.log('OK', f);
  }
} finally {
  await pool.end();
}
