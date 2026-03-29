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

# ── 0. Mjedis + URL ───────────────────────────────────────────
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

# Gjithmonë 127.0.0.1 (TCP) – network_mode:host e bën të aksesueshme
export DATABASE_URL="postgresql+psycopg2://jurist:jurist@127.0.0.1:5432/jurist"
export SECRET_KEY="${SECRET_KEY:-dev-secret-key-change-in-production}"
export ENVIRONMENT="development"
export STORAGE_LOCAL_PATH="$SCRIPT_DIR/backend/uploads"

# ── 1. Kontrollo Node + Python ────────────────────────────────
info "Duke kontrolluar pre-requisitet..."
command -v node    &>/dev/null || err "Node.js nuk u gjet → https://nodejs.org"
command -v python3 &>/dev/null || err "Python3 nuk u gjet → https://python.org"
command -v docker  &>/dev/null || err "Docker nuk u gjet → https://docs.docker.com/get-docker/"
docker info &>/dev/null 2>&1   || err "Docker nuk është aktiv. Ndize Docker Desktop."
ok "Node $(node -v)  Python $(python3 --version)  Docker ✓"

# ── 2. PostgreSQL me host-network ─────────────────────────────
info "Duke kontrolluar PostgreSQL..."

db_ready() {
  # With network_mode:host, pg is on 127.0.0.1:5432
  pg_isready -h 127.0.0.1 -p 5432 -U jurist -q 2>/dev/null && return 0
  # Fallback via docker exec
  docker exec jurist_db_dev pg_isready -U jurist -q 2>/dev/null && return 0
  return 1
}

# Krijo direktorinë e të dhënave (bind-mount) para compose
mkdir -p "$SCRIPT_DIR/data/postgres"

if db_ready; then
  ok "PostgreSQL aktiv ✓"
else
  info "Duke ndezur PostgreSQL (Docker host-network)..."
  # Ndalо container të vjetër nëse ekziston me konfig të vjetër
  docker compose -f docker-compose.dev.yml down 2>/dev/null || true
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
  info "Duke instaluar frontend dependencies (herën e parë)..."
  npm install --prefix frontend --silent
  ok "Frontend dependencies instaluar"
fi

if [ ! -d "backend/.venv" ]; then
  info "Duke krijuar Python venv (herën e parë)..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install --quiet -r backend/requirements.txt
  ok "Python dependencies instaluar"
fi

if [ ! -f "backend/.env" ]; then
  cp .env.example backend/.env
  ok "backend/.env u krijua"
fi

# ── 4. Seed – gjithmonë (idempotent) ──────────────────────────
info "Duke ekzekutuar seed (admin user)..."
mkdir -p backend/uploads
cd backend
PYTHONPATH="$SCRIPT_DIR/backend" .venv/bin/python seed.py 2>&1 | grep -v "^$" | sed "s/^/  /" || warn "Seed pati problem – vazhdo"
cd "$SCRIPT_DIR"
ok "Seed ✓"

# ── 5. Vrit proceset e vjetra ─────────────────────────────────
PID_FILE="$SCRIPT_DIR/.jurist_pids"
if [ -f "$PID_FILE" ]; then
  info "Duke ndalur instancat e vjetra..."
  while IFS= read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# ── 6. Backend ────────────────────────────────────────────────
info "Duke ndezur backend (port 8000)..."
cd backend
PYTHONPATH="$SCRIPT_DIR/backend" .venv/bin/uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 --reload --log-level warning &
BACK_PID=$!
echo "$BACK_PID" >> "$PID_FILE"
cd "$SCRIPT_DIR"

MAX=25; i=0
while ! curl -sf http://127.0.0.1:8000/health &>/dev/null; do
  i=$((i+1)); [ $i -ge $MAX ] && { kill $BACK_PID 2>/dev/null; err "Backend nuk u ndez"; }
  printf "\r${C}  ›  Duke pritur backend... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "Backend gati ✓"

# ── 7. Frontend ───────────────────────────────────────────────
info "Duke ndezur frontend (port 5173)..."
npm run dev --prefix frontend -- --host 0.0.0.0 --port 5173 &
FRONT_PID=$!
echo "$FRONT_PID" >> "$PID_FILE"

MAX=20; i=0
while ! nc -z 127.0.0.1 5173 2>/dev/null; do
  i=$((i+1)); [ $i -ge $MAX ] && { warn "Frontend vonoi – vazhdo"; break; }
  printf "\r${C}  ›  Duke pritur frontend... ($i/${MAX})${NC}"
  sleep 1
done
echo ""
ok "Frontend gati ✓"

# ── 8. Ports Public në Codespaces ────────────────────────────
if [ "$IS_CODESPACE" = true ] && command -v gh &>/dev/null; then
  gh codespace ports visibility 5173:public 8000:public -c "$CODESPACE_NAME" 2>/dev/null \
    && ok "Ports 5173 + 8000 → Public ✓" \
    || true
fi

# ── 9. Hap shfletuesin (lokal) ────────────────────────────────
if [ "$IS_CODESPACE" = false ]; then
  command -v xdg-open &>/dev/null && xdg-open "$FRONT_URL" &
  command -v open     &>/dev/null && open     "$FRONT_URL" &
fi

# ── 10. Mesazh final ──────────────────────────────────────────
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
  echo -e "  ${Y}Nëse nuk hapet:${NC} Ports tab → klik djathtas 5173 → Public"
  echo ""
fi
echo -e "  ${R}Ctrl+C   :${NC}  ndalon të gjitha shërbimet"
echo ""

# ── 11. Pastro kur mbyllet ────────────────────────────────────
cleanup() {
  echo ""
  info "Duke ndalur Jurist Pro..."
  [ -f "$PID_FILE" ] && while IFS= read -r pid; do kill "$pid" 2>/dev/null || true; done < "$PID_FILE"
  rm -f "$PID_FILE"
  # DB nuk ndalet – data ruan në disk, starton shpejt herën tjetër
  info "Shërbimet u ndalën. DB mbetet aktive për herën tjetër."
  exit 0
}
trap cleanup INT TERM
wait
