/**
 * App-wide config. Prefer `.env` in the `mobile/` folder (see `.env.example`).
 * Expo inlines `EXPO_PUBLIC_*` at bundle time — restart Metro after editing `.env`.
 */

function readEnvBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback;
  const v = raw.toLowerCase().trim();
  if (['false', '0', 'no'].includes(v)) return false;
  if (['true', '1', 'yes'].includes(v)) return true;
  return fallback;
}

/** API root including `/v1`, no trailing slash. Simulator: `http://localhost:3001/v1`. Device: `http://<lan-ip>:3001/v1`. */
export const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

/**
 * When `true`, services use local mocks / on-device storage.
 * Set `EXPO_PUBLIC_USE_LOCAL=false` in `.env` to use the backend (`BASE_URL` must be set).
 */
export const USE_LOCAL = readEnvBool(process.env.EXPO_PUBLIC_USE_LOCAL, true);
