#!/bin/bash
# Jurist Platform — startup script për Codespace / local dev
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Jurist Pro — Starting Up         ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ─── 1. PostgreSQL ───────────────────────────────────────────────────────────
echo "▶ Duke nisur PostgreSQL..."
if pg_isready -h localhost -q 2>/dev/null; then
  echo "  · PostgreSQL tashmë po ecën"
else
  sudo pg_ctlcluster 16 main start 2>/dev/null || \
  sudo service postgresql start 2>/dev/null || \
  pg_ctl start -D /var/lib/postgresql/16/main 2>/dev/null || \
  echo "  ⚠ Nuk mund të niset PostgreSQL automatikisht — nise manualisht"

  sleep 2
  pg_isready -h localhost -q && echo "  ✓ PostgreSQL u nis" || echo "  ⚠ PostgreSQL ende nuk përgjigjet"
fi

# Krijo user dhe DB nëse nuk ekzistojnë
echo "  Duke konfiguruar databazën..."
sudo -u postgres psql -c "CREATE USER jurist WITH PASSWORD 'jurist';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE jurist OWNER jurist;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE jurist TO jurist;" 2>/dev/null || true
echo "  ✓ Database 'jurist' gati"

# ─── 2. Backend ──────────────────────────────────────────────────────────────
echo ""
echo "▶ Duke nisur backend..."
cd "$ROOT/backend"

# Kopjo .env.dev si .env nëse nuk ekziston
if [ ! -f ".env" ]; then
  cp .env.dev .env
  echo "  ✓ .env krijuar nga .env.dev"
fi

# Instalo dependencies nëse mungojnë
if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "  Installing Python dependencies..."
  pip install -r requirements.txt -q
fi

# Nis backend në background
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > /tmp/jurist-backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✓ Backend po ecën (PID $BACKEND_PID)"

# Prit backend të ngrihet
echo "  Duke pritur backend..."
for i in $(seq 1 25); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "  ✓ Backend gati!"
    break
  fi
  sleep 1
  if [ $i -eq 25 ]; then
    echo "  ⚠ Backend u vonua — shiko /tmp/jurist-backend.log"
  fi
done

# Seed — krijon admin user nëse nuk ekziston
echo "  Duke inicializuar të dhënat..."
python3 seed.py || echo "  ⚠ Seed dështoi — shiko loget"

# ─── 3. Frontend ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Duke nisur frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  echo "  Installing Node.js dependencies..."
  npm install --silent
fi

npm run dev > /tmp/jurist-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✓ Frontend po ecën (PID $FRONTEND_PID)"

sleep 3

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Jurist Pro është gati!                               ║"
echo "║                                                          ║"
echo "║  Frontend  →  http://localhost:5173                      ║"
echo "║  Backend   →  http://localhost:8000                      ║"
echo "║  API Docs  →  http://localhost:8000/docs                 ║"
echo "║                                                          ║"
echo "║  Login:  admin@jurist.al  /  Admin123!                   ║"
echo "║                                                          ║"
echo "║  Logs:   /tmp/jurist-backend.log                        ║"
echo "║          /tmp/jurist-frontend.log                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Shtyp Ctrl+C për të ndalur gjithçka"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Ndalur.'" EXIT INT TERM
wait $BACKEND_PID $FRONTEND_PID
