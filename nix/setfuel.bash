# SetFuel — one entrypoint for all Nix-driven dev commands.
# Used by: nix run .#setfuel -- <command>   or   nix run .#postgres-up, etc.

repo_root() {
  if [ -n "${SETFUEL_ROOT:-}" ]; then
    printf '%s' "$SETFUEL_ROOT"
  elif git rev-parse --show-toplevel >/dev/null 2>&1; then
    git rev-parse --show-toplevel
  else
    printf '%s' "${PWD:-.}"
  fi
}

usage() {
  cat <<'EOF'
Usage: setfuel <command>

  postgres-up       Start local Postgres (data in .setfuel/postgres-data)
  postgres-down     Stop it
  postgres-status   pg_ctl status
  db-create         createdb setfuel if missing
  backend-install   npm install in backend/
  backend-migrate   Ensure backend/.env, npm install if needed, run db:migrate
  backend-build     Typecheck backend (tsc → dist/) — fails on TS errors
  mobile-install    npm install in mobile/
  mobile-start      Expo dev server (Metro); Ctrl+C to stop
  mobile-build      Typecheck mobile (tsc --noEmit) — fails on TS errors

Or: nix run .#postgres-up   (same commands as shortcut apps)
EOF
}

cmd="${1:-}"
shift || true

case "$cmd" in
  postgres-up)
    ROOT="$(repo_root)"
    PGDATA="${PGDATA:-$ROOT/.setfuel/postgres-data}"
    LOG="${SETFUEL_PG_LOG:-$ROOT/.setfuel/postgres.log}"
    PORT="${SETFUEL_PG_PORT:-5432}"
    mkdir -p "$(dirname "$PGDATA")"
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      echo "Initializing cluster at $PGDATA"
      initdb -D "$PGDATA" -U postgres \
        --locale=C --encoding=UTF8 \
        --auth-local=trust --auth-host=trust
    fi
    if pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
      echo "PostgreSQL already running (PGDATA=$PGDATA)"
      exit 0
    fi
    mkdir -p "$(dirname "$LOG")"
    pg_ctl -D "$PGDATA" -l "$LOG" -o "-p $PORT -h 127.0.0.1" start
    echo "PostgreSQL listening on 127.0.0.1:$PORT (PGDATA=$PGDATA)"
    echo "DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/setfuel"
    ;;

  postgres-down)
    ROOT="$(repo_root)"
    PGDATA="${PGDATA:-$ROOT/.setfuel/postgres-data}"
    if [ ! -d "$PGDATA" ]; then
      echo "No cluster at $PGDATA — nothing to stop"
      exit 0
    fi
    pg_ctl -D "$PGDATA" stop || true
    echo "Stopped (PGDATA=$PGDATA)"
    ;;

  postgres-status)
    ROOT="$(repo_root)"
    PGDATA="${PGDATA:-$ROOT/.setfuel/postgres-data}"
    PORT="${SETFUEL_PG_PORT:-5432}"
    if [ ! -d "$PGDATA" ]; then
      echo "No cluster initialized. Run: nix run .#setfuel -- postgres-up"
      exit 1
    fi
    pg_ctl -D "$PGDATA" status || true
    echo "PGDATA=$PGDATA PORT=$PORT"
    ;;

  db-create)
    ROOT="$(repo_root)"
    PORT="${SETFUEL_PG_PORT:-5432}"
    export PGHOST=127.0.0.1
    export PGPORT="$PORT"
    export PGUSER=postgres
    if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='setfuel'" | grep -qx 1; then
      echo "Database 'setfuel' already exists"
      exit 0
    fi
    createdb setfuel
    echo "Created database 'setfuel' on port $PORT"
    ;;

  backend-migrate)
    ROOT="$(repo_root)"
    cd "$ROOT/backend"
    if [ ! -f .env ] && [ -f .env.example ]; then
      echo "No backend/.env — copying .env.example to .env"
      cp .env.example .env
    fi
    if [ ! -d node_modules ]; then
      echo "Installing backend dependencies…"
      npm install
    fi
    npm run db:migrate
    ;;

  backend-install)
    ROOT="$(repo_root)"
    cd "$ROOT/backend"
    npm install
    ;;

  mobile-install)
    ROOT="$(repo_root)"
    cd "$ROOT/mobile"
    npm install
    ;;

  mobile-start)
    ROOT="$(repo_root)"
    cd "$ROOT/mobile"
    if [ ! -d node_modules ]; then
      echo "Installing mobile dependencies…"
      npm install
    fi
    npm run start
    ;;

  backend-build)
    ROOT="$(repo_root)"
    cd "$ROOT/backend"
    if [ ! -d node_modules ]; then
      echo "Installing backend dependencies…"
      npm install
    fi
    echo "=== backend: npm run build (tsc) ==="
    npm run build
    echo "=== backend build OK ==="
    ;;

  mobile-build)
    ROOT="$(repo_root)"
    cd "$ROOT/mobile"
    if [ ! -d node_modules ]; then
      echo "Installing mobile dependencies…"
      npm install
    fi
    echo "=== mobile: npm run typecheck (tsc --noEmit) ==="
    npm run typecheck
    echo "=== mobile typecheck OK ==="
    ;;

  "" | help | -h | --help)
    usage
    ;;

  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
