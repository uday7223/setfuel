-- Add Google OAuth identity column to support Google Sign-In.
-- google_id stores the Google account "sub" (stable user identifier).
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
