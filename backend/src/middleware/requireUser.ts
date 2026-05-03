import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

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
    res.status(401).json({ message: 'Authorization header missing or malformed' });
    return;
  }

  const token = authHeader.slice(7);

  if (!config.jwtSecret) {
    res.status(500).json({ message: 'Server misconfigured: JWT_SECRET not set' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    res.locals.userId = Number(payload.sub);
    next();
  } catch (e) {
    const isExpired = e instanceof jwt.TokenExpiredError;
    res.status(401).json({ message: isExpired ? 'Token expired' : 'Invalid token' });
  }
}
