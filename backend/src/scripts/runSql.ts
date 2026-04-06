/**
 * Run a .sql file against DATABASE_URL (for local / personal workflows).
 * Usage: npm run db:migrate
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node runSql.ts <path-to.sql>');
  process.exit(1);
}

const sqlPath = join(process.cwd(), fileArg);
const sql = readFileSync(sqlPath, 'utf8');

const pool = new pg.Pool({ connectionString: url });
try {
  await pool.query(sql);
  console.log('OK:', sqlPath);
} finally {
  await pool.end();
}
