# SetFuel — Nix development

This repo includes a **Nix flake** so macOS, Linux, and **WSL2** can share the same **Node 22**, **PostgreSQL 16 CLI**, and scripted workflows. Nix does **not** replace native Windows shells unless you use **Nix on WSL** or **nix develop** from a Unix-like environment.

## Prerequisites

1. [Install Nix](https://nixos.org/download/) with flakes enabled (`experimental-features = nix-command flakes` in `~/.config/nix/nix.conf`).
2. From the **repository root** (where `flake.nix` lives), run the commands below.

## Layout

| Path | Role |
|------|------|
| `flake.nix` | Flake inputs + delegates per-system outputs to `nix/app.nix` |
| `nix/app.nix` | Dev shell, `apps` (`nix run .#…`), and the `setfuel` CLI package |
| `nix/setfuel.bash` | **All** shell logic (Postgres + npm); one file, `case`-dispatched commands |

List commands: `nix run .#setfuel -- help`. Shortcuts like `nix run .#postgres-up` still work; they call the same script.

## One-time: lock inputs

After cloning (or when inputs change):

```bash
nix flake lock
```

Commit `flake.lock` when you intentionally bump dependencies.

## Enter the dev shell

Provides **Node 22**, **psql/initdb/pg_ctl**, **git**, **openssl**:

```bash
nix develop
```

Optional: install [direnv](https://direnv.net/) and run `direnv allow` in the repo to auto-load the flake when you `cd` here (see `.envrc`).

## Local PostgreSQL (no Docker required)

Data lives in **`.setfuel/postgres-data`** (gitignored). Default port **5432**; override with **`SETFUEL_PG_PORT`** if something else already uses it.

| Command | What it does |
|--------|----------------|
| `nix run .#postgres-up` | `initdb` if needed, then start Postgres on `127.0.0.1` |
| `nix run .#postgres-status` | `pg_ctl status` + paths |
| `nix run .#postgres-down` | Stop the cluster |
| `nix run .#db-create` | Create database `setfuel` if missing |
| `nix run .#backend-install` | `npm install` in `backend/` |
| `nix run .#backend-migrate` | Copy `backend/.env` from example if missing, `npm install` if needed, run `npm run db:migrate` |
| `nix run .#backend-build` | `npm run build` in `backend/` (`tsc`); fails on TypeScript errors |
| `nix run .#mobile-install` | `npm install` in `mobile/` |
| `nix run .#mobile-start` | `npm run start` in `mobile/` (Expo / Metro; long-running) |
| `nix run .#mobile-build` | `npm run typecheck` in `mobile/` (`tsc --noEmit`); fails on TS errors (not EAS) |

### Compile checks (find errors without starting servers)

From repo root:

```bash
nix run .#backend-build   # backend tsc
nix run .#mobile-build    # mobile tsc --noEmit
```

### Typical backend bootstrap

From repo root:

```bash
nix run .#postgres-up
nix run .#db-create
nix run .#backend-install
nix run .#backend-migrate
```

Set **`backend/.env`** `DATABASE_URL` to match your port, for example:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/setfuel
```

(Trust auth is enabled for localhost in this dev cluster; no password.)

Then:

```bash
cd backend && npm run dev
```

## Node version without Nix

If you use **nvm** / **fnm** instead, see **`.nvmrc`** (`22`).

## Windows (native PowerShell)

The Nix CLI targets **Unix-style** environments. Use **WSL2** with Nix installed, or keep using a natively installed Postgres + Node as in `backend/README.md`.
