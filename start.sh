#!/usr/bin/env bash
set -euo pipefail

# Jurist Pro local/Codespaces runner.
# Usage:
#   bash start.sh       # one-command clean local start
#   bash start.sh stop  # stop backend/frontend/db

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PID_FILE="$ROOT_DIR/.dev_pids"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR ]${NC} $*" >&2; }

have() {
  command -v "$1" >/dev/null 2>&1
}

stop_processes() {
  info "Stopping old Jurist dev processes..."
  if [ -f "$PID_FILE" ]; then
    while IFS= read -r pid; do
      [ -n "$pid" ] && kill "$pid" >/dev/null 2>&1 || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  pkill -f "uvicorn app.main:app" >/dev/null 2>&1 || true
  pkill -f "vite.*5173" >/dev/null 2>&1 || true
  pkill -f "npm run dev:frontend" >/dev/null 2>&1 || true
  pkill -f "npm run dev:backend" >/dev/null 2>&1 || true
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-60}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      info "$name is ready: $url"
      return 0
    fi
    sleep 1
  done
  err "$name did not become ready: $url"
  return 1
}

wait_for_db() {
  info "Waiting for PostgreSQL..."
  for _ in $(seq 1 60); do
    if docker compose -f "$ROOT_DIR/docker-compose.dev.yml" exec -T db pg_isready -U jurist -d jurist >/dev/null 2>&1; then
      info "PostgreSQL is ready"
      return 0
    fi
    sleep 1
  done
  err "PostgreSQL did not become ready"
  return 1
}

write_env_files() {
  info "Writing local dev env files..."
  cat > "$BACKEND_DIR/.env" <<'EOF'
DATABASE_URL=postgresql+psycopg2://jurist:jurist@localhost:5432/jurist
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development
RESET_ADMIN_PASSWORD=true
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
STORAGE_TYPE=local
STORAGE_PATH=./storage
OPENAI_API_KEY=
EOF

  cat > "$FRONTEND_DIR/.env.development" <<'EOF'
VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
EOF

  # A stale VITE_API_URL=http://localhost:8000 in .env.local breaks Codespaces,
  # because the browser's localhost is not the Codespace backend.
  rm -f "$FRONTEND_DIR/.env.local"
}

ensure_dependencies() {
  if ! have docker; then
    err "docker is required in Codespaces to start PostgreSQL."
    exit 1
  fi
  if ! have npm; then
    err "npm is required to start the frontend."
    exit 1
  fi
  if ! have python3; then
    err "python3 is required to start the backend."
    exit 1
  fi

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "Installing frontend dependencies..."
    npm install --prefix "$FRONTEND_DIR"
  fi

  if [ ! -d "$BACKEND_DIR/.venv" ]; then
    info "Creating backend virtualenv..."
    python3 -m venv "$BACKEND_DIR/.venv"
  fi

  info "Installing backend dependencies..."
  "$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt" --quiet
}

seed_admin() {
  info "Resetting local admin login..."
  (
    cd "$BACKEND_DIR"
    RESET_ADMIN_PASSWORD=true ENVIRONMENT=development .venv/bin/python seed.py
  )
}

verify_login() {
  info "Verifying admin login through backend..."
  local response
  response="$(curl -fsS -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@jurist.al","password":"Admin123!"}' || true)"

  if echo "$response" | grep -q "access_token"; then
    info "Admin login OK: admin@jurist.al / Admin123!"
    return 0
  fi

  err "Admin login failed through backend. Response:"
  echo "$response" >&2
  return 1
}

start_db() {
  info "Starting PostgreSQL container..."
  docker compose -f "$ROOT_DIR/docker-compose.dev.yml" up -d db
  wait_for_db
}

start_backend() {
  info "Starting backend on port 8000..."
  (
    cd "$BACKEND_DIR"
    set -a
    # shellcheck disable=SC1091
    source "$BACKEND_DIR/.env"
    set +a
    PYTHONPATH="$BACKEND_DIR" "$BACKEND_DIR/.venv/bin/python" -m uvicorn app.main:app \
      --host 0.0.0.0 --port 8000 --reload
  ) &
  echo "$!" >> "$PID_FILE"
  wait_for_http "http://localhost:8000/health" "Backend"
}

start_frontend() {
  info "Starting frontend on fixed port 5173..."
  (
    cd "$ROOT_DIR"
    VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000 \
      npm run dev:frontend -- --strictPort
  ) &
  echo "$!" >> "$PID_FILE"
  wait_for_http "http://localhost:5173" "Frontend"
}

stop_all() {
  stop_processes
  docker compose -f "$ROOT_DIR/docker-compose.dev.yml" stop db >/dev/null 2>&1 || true
  info "Stopped."
}

case "${1:-run}" in
  stop)
    stop_all
    ;;
  run|all|"")
    stop_processes
    write_env_files
    ensure_dependencies
    start_db
    seed_admin
    start_backend
    verify_login
    start_frontend
    echo
    info "Jurist Pro is running."
    info "Frontend: http://localhost:5173"
    info "Backend : http://localhost:8000"
    info "Docs    : http://localhost:8000/docs"
    info "Login   : admin@jurist.al / Admin123!"
    info "Open the Codespaces forwarded URL for port 5173."
    info "Leave this terminal open. Press Ctrl+C to stop."
    trap stop_all INT TERM
    wait
    ;;
  *)
    err "Unknown command: $1"
    err "Use: bash start.sh or bash start.sh stop"
    exit 1
    ;;
esac
