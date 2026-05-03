import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getPool } from '../db/pool.js';

export const authRouter = Router();

const googleClient = new OAuth2Client(config.googleClientId);

interface AppUserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_uri: string | null;
}

/**
 * POST /auth/google
 * Body: { idToken: string }
 *
 * Verifies the Google ID token, upserts the user in app_user,
 * and returns a signed application JWT.
 */
authRouter.post('/google', async (req, res) => {
  const { idToken } = req.body as { idToken?: string };

  if (!idToken || typeof idToken !== 'string') {
    res.status(400).json({ message: 'idToken is required' });
    return;
  }

  if (!config.googleClientId) {
    res.status(500).json({ message: 'Server misconfigured: GOOGLE_CLIENT_ID not set' });
    return;
  }

  if (!config.jwtSecret) {
    res.status(500).json({ message: 'Server misconfigured: JWT_SECRET not set' });
    return;
  }

  const pool = getPool();
  if (!pool) {
    res.status(503).json({ message: 'Database unavailable' });
    return;
  }

  // 1. Verify Google ID token
  let googlePayload: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
  };

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      res.status(401).json({ message: 'Invalid Google token payload' });
      return;
    }
    googlePayload = {
      sub: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture,
    };
  } catch {
    res.status(401).json({ message: 'Google token verification failed' });
    return;
  }

  // 2. Upsert user — insert on first sign-in, update avatar/name on subsequent ones
  try {
    const result = await pool.query<AppUserRow>(
      `INSERT INTO app_user (email, display_name, avatar_uri, google_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
         SET email        = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             avatar_uri   = EXCLUDED.avatar_uri
       RETURNING id::text, email, display_name, avatar_uri`,
      [googlePayload.email, googlePayload.name, googlePayload.picture ?? null, googlePayload.sub],
    );

    const user = result.rows[0];

    // 3. Sign application JWT (7-day expiry)
    const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUri: user.avatar_uri ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Database error';
    res.status(500).json({ message: msg });
  }
});
