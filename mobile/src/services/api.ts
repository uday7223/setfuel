/**
 * Centralised API client. Right now every call resolves locally.
 * When the backend is live, flip `USE_LOCAL` to false and set `BASE_URL`.
 *
 * Swap strategy:
 *   1. Set BASE_URL to your server (e.g. https://api.setfuel.app).
 *   2. Set USE_LOCAL = false.
 *   3. Each service function already returns Promises — nothing else changes.
 */

export const BASE_URL = ''; // e.g. 'https://api.setfuel.app/v1'
export const USE_LOCAL = true;

let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
}

export function getAuthToken(): string | null {
  return _authToken;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

/**
 * Thin wrapper around fetch that:
 *  - prepends BASE_URL
 *  - injects Authorization header
 *  - serialises JSON body
 *  - throws on non-2xx with parsed error body
 */
export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = opts;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };
  if (_authToken) {
    reqHeaders['Authorization'] = `Bearer ${_authToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: reqHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw Object.assign(new Error(errBody.message ?? `API ${res.status}`), {
      status: res.status,
      body: errBody,
    });
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Generate a temporary local ID. Server will assign the real one. */
export function localId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
