import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { closePool } from './db/pool.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { v1Router } from './routes/v1/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, docs: 'GET /health, POST /auth/google, GET /v1' });
});

app.use('/health', healthRouter);
app.use('/auth', authRouter);   // public — no JWT required
app.use('/v1', v1Router);       // protected — requireUser checks Bearer JWT

const server = app.listen(config.port, () => {
  console.log(`SetFuel API http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} — shutting down`);
  server.close();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
