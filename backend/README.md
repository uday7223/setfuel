# SetFuel — backend

Node.js **Express** + **PostgreSQL** (`pg`), TypeScript. Auth is not wired yet: every `/v1/*` route (except `GET /v1`) uses the **first row** in `app_user` (seed `dev@local.test` after migrations).

## Prerequisites

- Node 20+ (repo Nix flake pins **22**; see `../.nvmrc`)
- PostgreSQL

Optional: same Postgres + Node + migrations on macOS / Linux / **WSL2** via **Nix** — [docs/nix.md](../docs/nix.md).

## Setup

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL and optional PORT (default 3001)
npm install
createdb setfuel   # or your DB name
npm run db:migrate
npm run dev
```

`npm run db:migrate` runs every `sql/*.sql` file in alphabetical order (`001_init.sql`, `002_api_core.sql`, …).

One-off SQL file: `npm run db:sql -- sql/custom.sql`

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run `dist/app.js` |
| `npm run db:migrate` | Apply all `sql/*.sql` in order |
| `npm run db:sql -- <file>` | Run a single `.sql` file |

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| | **Public** | |
| `GET` | `/` | Welcome |
| `GET` | `/health` | Liveness |
| `GET` | `/health/db` | DB ping |
| `GET` | `/v1` | Route index (no DB user required) |
| | **Authenticated as first `app_user`** | |
| `GET` | `/v1/user/profile` | |
| `GET` | `/v1/user/dashboard-summary` | Home-style aggregates |
| `GET` | `/v1/programs` | Workout programs |
| `POST` | `/v1/programs` | Body: `{ title, dayLabel?, blocks? }` |
| `PUT` | `/v1/programs/:id` | Full replace |
| `DELETE` | `/v1/programs/:id` | |
| `GET` | `/v1/sessions/active` | `null` if none |
| `POST` | `/v1/sessions` | Starts session; ends any previous active |
| `POST` | `/v1/sessions/:id/end` | |
| `POST` | `/v1/sessions/:id/exercises` | Body: `{ name }` |
| `DELETE` | `/v1/exercises/:exerciseId` | Active session |
| `PATCH` | `/v1/exercises/:exerciseId` | Body: `{ name }` |
| `POST` | `/v1/exercises/:exerciseId/sets` | |
| `DELETE` | `/v1/sets/:setId` | |
| `PATCH` | `/v1/sets/:setId` | Body: `{ reps?, weightKg?, done? }` |
| `POST` | `/v1/sets/:setId/toggle` | Returns `{ done }` |
| `GET` | `/v1/meals` | |
| `POST` | `/v1/meals` | Body: `CreateMealPayload` |
| `DELETE` | `/v1/meals/:id` | |
| `GET` | `/v1/meals/daily-summary` | |

## Mobile app

In `mobile/.env` (copy from `mobile/.env.example`):

1. `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001/v1` (simulator) or `http://<lan-ip>:3001/v1` (device).
2. `EXPO_PUBLIC_USE_LOCAL=false`

Restart Metro after changing env. Defaults are defined in `mobile/src/constant.ts`.

Programs on the workout screen may still use **local** `routinesStorage` until you point that flow at `GET/POST /v1/programs`.

## Later (production-grade)

- JWT (or sessions) and per-user `app_user` resolution
- HTTPS, rate limits, structured logging
- Prisma or Drizzle + proper migrations
- Never commit `.env`
