#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  JURIST PRO  –  One-click Launcher  (Linux / macOS / Codespaces)
#  bash Jurist-Start.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; C='\033[1;36m'; NC='\033[0m'
ok()   { echo -e "${G}  ✔  $1${NC}"; }
warn() { echo -e "${Y}  ⚠  $1${NC}"; }
err()  { echo -e "${R}  ✖  $1${NC}"; exit 1; }
info() { echo -e "${C}  ›  $1${NC}"; }

clear
echo -e "${C}"
cat << 'BANNER'
  ╔══════════════════════════════════════════════════╗
  ║           JURIST PRO  –  Albanian Legal          ║
  ║        Procurement Document Management           ║
  ╚══════════════════════════════════════════════════╝
BANNER
echo -e "${NC}"

# ── 0. Detekto mjedis ─────────────────────────────────────────
if [ -n "${CODESPACES:-}" ] && [ -n "${CODESPACE_NAME:-}" ]; then
  IS_CODESPACE=true
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  FRONT_URL="https://${CODESPACE_NAME}-5173.${DOMAIN}"
  BACK_URL="https://${CODESPACE_NAME}-8000.${DOMAIN}"
  info "Mjedis: GitHub Codespaces"
else
  IS_CODESPACE=false
  FRONT_URL="http://localhost:5173"
  BACK_URL="http://localhost:8000"
  info "Mjedis: lokal"
fi

# In Codespaces Docker networking, use container name; locally use localhost
if docker inspect jurist_db_dev &>/dev/null 2>&1; then
  DB_HOST="localhost"
  # Check if container port is reachable via localhost; if not, use container IP
  if ! nc -z localhost 5432 2>/dev/null; then
    DB_HOST=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' jurist_db_dev 2>/dev/null || echo "localhost")
  fi
else
  DB_HOST="localhost"
fi
export DATABASE_URL="postgresql+psycopg2://jurist:jurist@${DB_HOST}:5432/jurist"
export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-in-production}"
export ENVIRONMENT="development"
export STORAGE_LOCAL_PATH="$SCRIPT_DIR/backend/uploads"

# ── 1. Kontrollo Node + Python ────────────────────────────────
info "Duke kontrolluar pre-requisitet..."
command -v node   &>/dev/null || err "Node.js nuk u gjet → https://nodejs.org"
command -v python3 &>/dev/null || err "Python3 nuk u gjet → https://python.org"
ok "Node.js $(node -v) + Python $(python3 --version)"

# ── 2. PostgreSQL ─────────────────────────────────────────────
info "Duke kontrolluar PostgreSQL..."

db_ready() {
  # Try docker exec first (works in Codespaces where port isn't localhost)
  docker exec jurist_db_dev pg_isready -U jurist -q 2>/dev/null && return 0
  # Fallback: nc probe for local
  nc -z localhost 5432 2>/dev/null && return 0
  return 1
}

if db_ready; then
  ok "PostgreSQL tashmë aktiv ✓"
else
  if ! command -v docker &>/dev/null || ! docker info &>/dev/null 2>&1; then
    err "Docker nuk është aktiv dhe PostgreSQL nuk u gjet. Ndize Docker Desktop."
  fi
  info "Duke ndezur PostgreSQL me Docker..."
  docker compose -f docker-compose.dev.yml up -d db
  MAX=45; i=0
  while ! db_ready; do
    i=$((i+1)); [ $i -ge $MAX ] && err "PostgreSQL nuk u ndez brenda ${MAX}s"
    printf "\r${C}  ›  Duke pritur PostgreSQL... ($i/${MAX})${NC}"
    sleep 1
  done
  echo ""
  ok "PostgreSQL gati ✓"
fi

# ── 3. Instalo varësitë nëse mungojnë ────────────────────────
if [ ! -d "frontend/node_modules" ]; then
  info "Duke instaluar frontend dependencies..."
  npm install --prefix frontend --silent
  ok "Frontend dependencies instaluar"
fi

if [ ! -d "backend/.venv" ]; then
  info "Duke krijuar Python venv..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
  ok "Python dependencies instaluar"
fi

# ── 4. Kopjo .env nëse mungon ─────────────────────────────────
if [ ! -f "backend/.env" ]; then
  cp .env.example backend/.env
  ok "backend/.env u krijua nga .env.example"
fi

# ── 5. Seed — gjithmonë (idempotent) ──────────────────────────
info "Duke ekzekutuar seed (admin user)..."
mkdir -p backend/uploads
cd backend
PYTHONPATH="$SCRIPT_DIR/backend" .venv/bin/python seed.py 2>&1 \
  | grep -v "^$" \
  | sed "s/^/  /" \
  || warn "Seed pati problem – vazhdo"
cd "$SCRIPT_DIR"
ok "Seed u ekzekutua ✓"

# ── 6. Vrit proceset e vjetra nëse ekzistojnë ────────────────
PID_FILE="$SCRIPT_DIR/.jurist_pids"
if [ -f "$PID_FILE" ]; then
  info "Duke ndalur instancat e vjetra..."
  while IFS= read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# ── 7. Nise Backend ───────────────────────────────────────────
info "Duke ndezur backend (port 8000)..."
cd backend
PYTHONPATH="$SCRIPT_DIR/backend" .venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 --reload --log-level warning &
BACK_PID=$!
echo "$BACK_PID" >> "$PID_FILE"
cd "$SCRIPT_DIR"

MAX=20; i=0
while ! curl -sf http://localhost:8000/health &>/dev/null; do
  i=$((i+1))
  [ $i -ge $MAX ] && { kill $BACK_PID 2>/dev/null; err "Backend nuk u ndez"; }
  printf "\r${C}  ›  Duke pritur backend... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "Backend gati ✓"

# ── 8. Nise Frontend ──────────────────────────────────────────
info "Duke ndezur frontend (port 5173)..."
npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173 &
FRONT_PID=$!
echo "$FRONT_PID" >> "$PID_FILE"

# Prit Vite
MAX=20; i=0
while ! nc -z localhost 5173 2>/dev/null; do
  i=$((i+1))
  [ $i -ge $MAX ] && { warn "Frontend vonoi – vazhdo"; break; }
  printf "\r${C}  ›  Duke pritur frontend... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "Frontend gati ✓"

# ── 9. Auto-bëj port-et Public në Codespaces ─────────────────
if [ "$IS_CODESPACE" = true ] && command -v gh &>/dev/null; then
  info "Duke bërë port-et Public në Codespaces..."
  gh codespace ports visibility 5173:public 8000:public \
    -c "$CODESPACE_NAME" 2>/dev/null \
    && ok "Ports 5173 + 8000 → Public ✓" \
    || warn "Ports duhen bërë Public manualisht (Ports tab → klik djathtas → Public)"
fi

# ── 10. Hap shfletuesin ───────────────────────────────────────
if [ "$IS_CODESPACE" = false ]; then
  command -v xdg-open &>/dev/null && xdg-open "$FRONT_URL" &
  command -v open     &>/dev/null && open     "$FRONT_URL" &
fi

# ── 11. Mesazhi final ─────────────────────────────────────────
echo ""
echo -e "${G}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${G}║         JURIST PRO  –  Aktiv!                    ║${NC}"
echo -e "${G}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${C}App      :${NC}  ${FRONT_URL}"
echo -e "  ${C}API Docs :${NC}  ${BACK_URL}/docs"
echo ""
echo -e "  ${Y}Login    :${NC}  admin@jurist.al  /  Admin123!"
echo ""
if [ "$IS_CODESPACE" = true ]; then
  echo -e "  ${Y}Ports    :${NC}  Nëse nuk hapet, bëji Public:"
  echo -e "             Ports tab → klik djathtas 5173 → Public"
  echo ""
fi
echo -e "  ${R}Ctrl+C   :${NC}  ndalon të gjitha shërbimet"
echo ""

# ── 12. Pastro kur mbyllet ────────────────────────────────────
cleanup() {
  echo ""
  info "Duke ndalur Jurist Pro..."
  [ -f "$PID_FILE" ] && while IFS= read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < "$PID_FILE" && rm -f "$PID_FILE"
  docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" stop db 2>/dev/null || true
  ok "Done."
  exit 0
}
trap cleanup INT TERM
wait
