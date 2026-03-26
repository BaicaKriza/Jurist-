#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Jurist Pro – Development Startup Script
#
# Usage:
#   bash start.sh          # Start everything (DB + backend + frontend)
#   bash start.sh db       # Start only the database (PostgreSQL)
#   bash start.sh backend  # Start only the backend (requires DB running)
#   bash start.sh frontend # Start only the frontend
#   bash start.sh seed     # Run seed.py to bootstrap admin user
#   bash start.sh stop     # Stop all background processes
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_FILE="$SCRIPT_DIR/.dev_pids"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR ]${NC} $1"; }

# ── Helpers ───────────────────────────────────────────────────────────────────
wait_for_port() {
  local host="$1" port="$2" service="$3"
  local attempts=0 max=30
  while ! nc -z "$host" "$port" 2>/dev/null; do
    attempts=$((attempts+1))
    if [ $attempts -ge $max ]; then
      error "$service did not start in time on $host:$port"
      return 1
    fi
    sleep 1
  done
  info "$service is ready on $host:$port"
}

start_db() {
  info "Starting PostgreSQL via Docker Compose…"
  docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" up -d db
  wait_for_port localhost 5432 "PostgreSQL"
}

seed_db() {
  info "Running seed.py…"
  cd "$BACKEND_DIR"
  if [ -f ".venv/bin/python" ]; then
    PYTHONPATH="$BACKEND_DIR" .venv/bin/python seed.py
  else
    PYTHONPATH="$BACKEND_DIR" python seed.py
  fi
}

start_backend() {
  info "Starting backend (FastAPI on :8000)…"
  cd "$BACKEND_DIR"

  # Create venv if missing
  if [ ! -d ".venv" ]; then
    warn "No .venv found – creating one…"
    python3 -m venv .venv
    .venv/bin/pip install --quiet -r requirements.txt
  fi

  # Create uploads directory for local storage fallback
  mkdir -p "$BACKEND_DIR/uploads"

  # Set DB URL to local dev DB
  export DATABASE_URL="${DATABASE_URL:-postgresql+psycopg2://jurist:jurist@localhost:5432/jurist}"
  export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-in-production}"
  export ENVIRONMENT="development"
  export MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost:9000}"
  export STORAGE_LOCAL_PATH="$BACKEND_DIR/uploads"

  PYTHONPATH="$BACKEND_DIR" .venv/bin/uvicorn app.main:app \
    --host 0.0.0.0 --port 8000 --reload &
  BACKEND_PID=$!
  echo "$BACKEND_PID" >> "$PID_FILE"
  info "Backend started (PID $BACKEND_PID)"
  wait_for_port localhost 8000 "Backend"
}

start_frontend() {
  info "Starting frontend (Vite on :5173)…"
  cd "$FRONTEND_DIR"

  if [ ! -d "node_modules" ]; then
    warn "node_modules missing – running npm install…"
    npm install --silent
  fi

  # Don't set VITE_API_URL – vite proxy handles /api → :8000
  npm run dev &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" >> "$PID_FILE"
  info "Frontend started (PID $FRONTEND_PID)"
  # Vite may take a few seconds; give it time
  sleep 3
  info "Frontend starting on http://localhost:5173"
}

stop_all() {
  if [ -f "$PID_FILE" ]; then
    info "Stopping background processes…"
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null && info "  killed PID $pid" || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" stop db 2>/dev/null || true
  info "Done."
}

# ── Main ──────────────────────────────────────────────────────────────────────
CMD="${1:-all}"
rm -f "$PID_FILE"

case "$CMD" in
  db)
    start_db
    ;;
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  seed)
    seed_db
    ;;
  stop)
    stop_all
    ;;
  all|*)
    start_db
    start_backend
    seed_db || warn "Seed failed or already seeded – continuing"
    start_frontend
    echo ""
    info "═══════════════════════════════════════════════════"
    info " Jurist Pro is running:"
    info "   Frontend : http://localhost:5173"
    info "   Backend  : http://localhost:8000"
    info "   API docs : http://localhost:8000/docs"
    info "   Admin    : admin@jurist.al / Admin123!"
    info "═══════════════════════════════════════════════════"
    info "Press Ctrl+C to stop all services"
    # Keep script alive
    trap stop_all INT TERM
    wait
    ;;
esac
