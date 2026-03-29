#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  JURIST PRO  –  Launcher  (Linux / macOS)
#  Klikoni dy herë ose hapni me terminal: bash Jurist-Start.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Ngjyra ────────────────────────────────────────────────────
G='\033[1;32m'; Y='\033[1;33m'; R='\033[1;31m'; C='\033[1;36m'; NC='\033[0m'
ok()   { echo -e "${G}  ✔  $1${NC}"; }
warn() { echo -e "${Y}  ⚠  $1${NC}"; }
err()  { echo -e "${R}  ✖  $1${NC}"; }
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

# ── 1. Kontrollo pre-requisitet ───────────────────────────────
info "Duke kontrolluar pre-requisitet..."

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 i gjetur: $(command -v $1)"
  else
    err "$1 NUK u gjet. Instalo: $2"
    exit 1
  fi
}

check_cmd "node"   "https://nodejs.org"
check_cmd "npm"    "https://nodejs.org"
check_cmd "python3" "https://python.org"
check_cmd "docker" "https://docs.docker.com/get-docker/"

# Versioni minimal Node 18
NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  err "Kërkohet Node.js >= 18. Verzioni aktual: $(node -v)"
  exit 1
fi
ok "Node.js $(node -v) ✓"

# Docker është aktiv?
if ! docker info &>/dev/null 2>&1; then
  err "Docker nuk është aktiv. Ndize Docker Desktop dhe provo sërish."
  exit 1
fi
ok "Docker aktiv ✓"

echo ""

# ── 2. Kopjo .env nëse mungon ─────────────────────────────────
if [ ! -f "backend/.env" ]; then
  warn "backend/.env mungon – duke krijuar nga .env.example"
  cp .env.example backend/.env
  ok "backend/.env u krijua"
fi

# ── 3. Instalo varësitë (vetëm herën e parë) ──────────────────
FIRST_RUN=false

if [ ! -d "frontend/node_modules" ]; then
  info "Duke instaluar frontend dependencies (herën e parë)..."
  npm install --prefix frontend --silent
  ok "Frontend dependencies instaluar"
  FIRST_RUN=true
fi

if [ ! -d "backend/.venv" ]; then
  info "Duke krijuar Python virtual environment (herën e parë)..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
  ok "Python dependencies instaluar"
  FIRST_RUN=true
fi

# ── 4. Nise PostgreSQL ────────────────────────────────────────
info "Duke ndezur PostgreSQL..."
docker compose -f docker-compose.dev.yml up -d db

# Prit derisa DB është gati
MAX=30; i=0
while ! docker exec jurist_db_dev pg_isready -U jurist -q 2>/dev/null; do
  i=$((i+1))
  if [ $i -ge $MAX ]; then err "PostgreSQL nuk u ndez brenda 30s"; exit 1; fi
  printf "\r${C}  ›  Duke pritur PostgreSQL... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "PostgreSQL gati ✓"

# ── 5. Seed (vetëm herën e parë) ─────────────────────────────
if [ "$FIRST_RUN" = true ]; then
  info "Duke ekzekutuar seed (admin user + të dhëna fillestare)..."
  cd backend
  PYTHONPATH="$SCRIPT_DIR/backend" DATABASE_URL="postgresql+psycopg2://jurist:jurist@localhost:5432/jurist" \
    .venv/bin/python seed.py || warn "Seed dështoi ose është ekzekutuar më parë – vazhdo"
  cd "$SCRIPT_DIR"
  ok "Seed u ekzekutua"
fi

# ── 6. Nise backend + frontend ────────────────────────────────
info "Duke ndezur Jurist Pro..."

PID_FILE="$SCRIPT_DIR/.jurist_pids"
rm -f "$PID_FILE"

mkdir -p backend/uploads

# Backend
export DATABASE_URL="postgresql+psycopg2://jurist:jurist@localhost:5432/jurist"
export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-in-production}"
export ENVIRONMENT="development"
export STORAGE_LOCAL_PATH="$SCRIPT_DIR/backend/uploads"

cd backend
PYTHONPATH="$SCRIPT_DIR/backend" .venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 --reload --log-level warning &
BACK_PID=$!
echo "$BACK_PID" >> "$PID_FILE"
cd "$SCRIPT_DIR"

# Prit backend
MAX=20; i=0
while ! curl -sf http://localhost:8000/health &>/dev/null; do
  i=$((i+1))
  if [ $i -ge $MAX ]; then err "Backend nuk u ndez"; kill $BACK_PID 2>/dev/null; exit 1; fi
  printf "\r${C}  ›  Duke pritur backend... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "Backend gati ✓"

# Frontend
npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173 &
FRONT_PID=$!
echo "$FRONT_PID" >> "$PID_FILE"

sleep 3
ok "Frontend gati ✓"

# ── 7. Ndërto URL-et (Codespaces vs lokal) ───────────────────
if [ -n "${CODESPACES:-}" ] && [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-github.dev}"
  FRONT_URL="https://${CODESPACE_NAME}-5173.${DOMAIN}"
  BACK_URL="https://${CODESPACE_NAME}-8000.${DOMAIN}"
  IS_CODESPACE=true
else
  FRONT_URL="http://localhost:5173"
  BACK_URL="http://localhost:8000"
  IS_CODESPACE=false
fi

# ── 8. Hap shfletuesin (vetëm lokal) ─────────────────────────
if [ "$IS_CODESPACE" = false ]; then
  if command -v xdg-open &>/dev/null; then
    xdg-open "$FRONT_URL" &
  elif command -v open &>/dev/null; then
    open "$FRONT_URL" &
  fi
fi

# ── 9. Mesazhi final ─────────────────────────────────────────
echo ""
echo -e "${G}═══════════════════════════════════════════════════${NC}"
echo -e "${G}  Jurist Pro është aktiv!${NC}"
echo -e "${G}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${C}Frontend :${NC}  ${FRONT_URL}"
echo -e "  ${C}Backend  :${NC}  ${BACK_URL}"
echo -e "  ${C}API Docs :${NC}  ${BACK_URL}/docs"
echo ""
if [ "$IS_CODESPACE" = true ]; then
  echo -e "  ${Y}Codespaces:${NC} Ports 5173 dhe 8000 duhet të jenë Public"
  echo -e "             (Ports tab → klikoni 🔒 → Change Port Visibility → Public)"
  echo ""
fi
echo -e "  ${Y}Login    :${NC}  admin@jurist.al  /  Admin123!"
echo ""
echo -e "  ${R}Shtyp Ctrl+C për të ndalur të gjitha shërbimet.${NC}"
echo ""

# ── 9. Mbaj aktiv + pastro kur mbyllet ────────────────────────
cleanup() {
  echo ""
  info "Duke ndalur Jurist Pro..."
  while IFS= read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < "$PID_FILE"
  rm -f "$PID_FILE"
  docker compose -f "$SCRIPT_DIR/docker-compose.dev.yml" stop db 2>/dev/null || true
  ok "Shërbimet u ndalën."
  exit 0
}

trap cleanup INT TERM
wait
