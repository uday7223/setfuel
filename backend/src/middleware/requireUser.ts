import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ module: 'requireUser' });

interface JwtPayload {
  sub: string;
}

/**
 * Verifies the Bearer JWT in the Authorization header and populates
 * `res.locals.userId`. Returns 401 for missing/invalid/expired tokens.
 */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    log.warn(
      { method: req.method, url: req.url },
      'Request rejected — Authorization header missing or malformed',
    );
    res.status(401).json({ message: 'Authorization header missing or malformed' });
    return;
  }

  const token = authHeader.slice(7);

  if (!config.jwtSecret) {
    log.error('JWT_SECRET is not configured — cannot verify tokens');
    res.status(500).json({ message: 'Server misconfigured: JWT_SECRET not set' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const userId = Number(payload.sub);
    res.locals.userId = userId;
    log.debug({ userId, method: req.method, url: req.url }, 'JWT verified — user authenticated');
    next();
  } catch (e) {
    const isExpired = e instanceof jwt.TokenExpiredError;
    const reason = isExpired ? 'Token expired' : 'Invalid token';
    log.warn({ reason, method: req.method, url: req.url }, `Auth rejected — ${reason}`);
    res.status(401).json({ message: reason });
  }
}
