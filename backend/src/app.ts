import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { IncomingMessage, ServerResponse } from 'http';
import { pinoHttp } from 'pino-http';
import { config } from './config.js';
import { closePool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { v1Router } from './routes/v1/index.js';

const app = express();

// ── HTTP request / response logging ──────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    customLogLevel(_req: IncomingMessage, res: ServerResponse, err?: Error) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage(req: IncomingMessage, res: ServerResponse) {
      return `${req.method} ${req.url} → ${res.statusCode}`;
    },
    customErrorMessage(req: IncomingMessage, res: ServerResponse, err: Error) {
      return `${req.method} ${req.url} → ${res.statusCode} — ${err.message}`;
    },
    serializers: {
      req(req: IncomingMessage & { headers: Record<string, string>; remoteAddress?: string }) {
        return {
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          ip: req.remoteAddress,
        };
      },
      res(res: ServerResponse) {
        return { statusCode: res.statusCode };
      },
    },
    // Skip noisy health-check polls from logging
    autoLogging: {
      ignore: (req: IncomingMessage) => req.url === '/health',
    },
  }),
);

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, docs: 'GET /health, POST /auth/google, GET /v1' });
});

app.use('/health', healthRouter);
app.use('/auth', authRouter);   // public — no JWT required
app.use('/v1', v1Router);       // protected — requireUser checks Bearer JWT

// ── Global error handler ─────────────────────────────────────────────────────
// Catches anything thrown / passed to next(err) by route handlers.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status ?? 500;
  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error(
    { err, method: req.method, url: req.url, status },
    `Unhandled error: ${message}`,
  );
  if (!res.headersSent) {
    res.status(status).json({ message });
  }
});

// ── Server startup ────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(
    {
      module: 'app',
      port: config.port,
      env: config.nodeEnv,
      db: config.databaseUrl ? 'configured' : 'NOT SET',
      jwt: config.jwtSecret ? 'configured' : 'NOT SET ⚠️',
      google: config.googleClientId ? 'configured' : 'NOT SET ⚠️',
    },
    `SetFuel API listening on http://localhost:${config.port}`,
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  logger.info({ module: 'app', signal }, `${signal} received — shutting down`);
  server.close(() => logger.info({ module: 'app' }, 'HTTP server closed'));
  await closePool();
  logger.info({ module: 'app' }, 'DB pool closed — bye');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// Log unhandled promise rejections instead of silently swallowing them
process.on('unhandledRejection', (reason) => {
  logger.error({ module: 'app', reason }, 'Unhandled promise rejection');
});
