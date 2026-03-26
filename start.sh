#!/bin/bash
# Jurist Platform — startup script për Codespace / local dev

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
  sudo service postgresql start 2>/dev/null || \
  sudo pg_ctlcluster 16 main start 2>/dev/null || \
  echo "  ⚠ PostgreSQL nuk u nis automatikisht"

  sleep 2
  if pg_isready -h localhost -q 2>/dev/null; then
    echo "  ✓ PostgreSQL u nis"
  else
    echo "  ⚠ PostgreSQL ende nuk përgjigjet — vazhdo gjithsesi"
  fi
fi

# Krijo user dhe DB nëse nuk ekzistojnë
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

# Instalo gjithmonë dependencies (kap ndryshimet në requirements.txt)
echo "  Duke instaluar Python dependencies..."
pip install -r requirements.txt -q 2>/dev/null

# Mbyll ndonjë process të vjetër
pkill -f "uvicorn app.main" 2>/dev/null || true
sleep 1

# Nis backend në background
uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/jurist-backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✓ Backend po ecën (PID $BACKEND_PID)"

# Prit backend të ngrihet
echo "  Duke pritur backend..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "  ✓ Backend gati!"
    break
  fi
  sleep 1
  if [ $i -eq 30 ]; then
    echo "  ⚠ Backend u vonua — shiko /tmp/jurist-backend.log"
    cat /tmp/jurist-backend.log | tail -5
  fi
done

# Seed — krijon admin user nëse nuk ekziston
echo "  Duke inicializuar të dhënat..."
python3 seed.py 2>/dev/null | grep -E "✓|✅|❌|·" || true

# ─── 3. Frontend ─────────────────────────────────────────────────────────────
echo ""
echo "▶ Duke nisur frontend..."
cd "$ROOT/frontend"

# Instalo gjithmonë (kap ndryshimet në package.json)
if [ ! -d "node_modules" ]; then
  echo "  Duke instaluar Node.js dependencies..."
  npm install --silent 2>/dev/null
fi

# Mbyll ndonjë process të vjetër në port 5173
pkill -f "vite" 2>/dev/null || true
fuser -k 5173/tcp 2>/dev/null || true
sleep 1

npm run dev > /tmp/jurist-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✓ Frontend po ecën (PID $FRONTEND_PID)"

sleep 4

# ─── Done ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Jurist Pro është gati!                               ║"
echo "║                                                          ║"
echo "║  Frontend  →  porto 5173 (hap nga Ports tab)            ║"
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
