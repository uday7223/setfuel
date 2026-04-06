-- Programs, workout sessions (JSON exercises), meals, profile fields.

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS avatar_uri TEXT;
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS goal_kcal INTEGER NOT NULL DEFAULT 2500;

INSERT INTO app_user (email, display_name)
VALUES ('dev@local.test', 'Dev User')
ON CONFLICT (email) DO NOTHING;

CREATE TABLE IF NOT EXISTS workout_program (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  day_label TEXT,
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_program_user ON workout_program (user_id);

CREATE TABLE IF NOT EXISTS workout_session (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_workout_session_user_ended ON workout_session (user_id, ended_at);

CREATE TABLE IF NOT EXISTS meal (
  id TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kcal INTEGER NOT NULL,
  time_display TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  image_uri TEXT,
  protein REAL,
  carbs REAL,
  fats REAL
);

CREATE INDEX IF NOT EXISTS idx_meal_user_created ON meal (user_id, created_at DESC);
