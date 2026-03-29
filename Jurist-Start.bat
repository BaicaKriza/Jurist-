@echo off
:: ═══════════════════════════════════════════════════════════════
::  JURIST PRO  –  Launcher  (Windows)
::  Klikoni dy herë mbi këtë skedar për të ndezur aplikacionin
:: ═══════════════════════════════════════════════════════════════
title Jurist Pro – Launcher
color 0B
chcp 65001 > nul 2>&1

echo.
echo   ╔══════════════════════════════════════════════════╗
echo   ║           JURIST PRO  –  Albanian Legal          ║
echo   ║        Procurement Document Management           ║
echo   ╚══════════════════════════════════════════════════╝
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:: ── 1. Kontrollo pre-requisitet ──────────────────────────────
echo [INFO] Duke kontrolluar pre-requisitet...

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERR] Node.js nuk u gjet. Shko te: https://nodejs.org dhe instalo.
  pause
  exit /b 1
)
echo [OK] Node.js: OK

where python >nul 2>&1
if %errorlevel% neq 0 (
  where python3 >nul 2>&1
  if %errorlevel% neq 0 (
    echo [ERR] Python nuk u gjet. Shko te: https://python.org dhe instalo.
    pause
    exit /b 1
  )
  set PYTHON=python3
) else (
  set PYTHON=python
)
echo [OK] Python: OK

where docker >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERR] Docker nuk u gjet. Shko te: https://docs.docker.com/get-docker/
  pause
  exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERR] Docker nuk eshte aktiv. Hap Docker Desktop dhe provo serish.
  pause
  exit /b 1
)
echo [OK] Docker: aktiv

:: ── 2. Kopjo .env nese mungon ─────────────────────────────────
if not exist "backend\.env" (
  echo [WARN] backend\.env mungon – duke krijuar nga .env.example
  copy ".env.example" "backend\.env" >nul
  echo [OK] backend\.env u krijua
)

:: ── 3. Instalo varsite (here e pare) ─────────────────────────
if not exist "frontend\node_modules" (
  echo [INFO] Duke instaluar frontend dependencies...
  npm install --prefix frontend --silent
  echo [OK] Frontend dependencies instaluar
  set FIRST_RUN=1
)

if not exist "backend\.venv" (
  echo [INFO] Duke krijuar Python virtual environment...
  %PYTHON% -m venv backend\.venv
  backend\.venv\Scripts\pip install --quiet -r backend\requirements.txt
  echo [OK] Python dependencies instaluar
  set FIRST_RUN=1
)

:: ── 4. Nise PostgreSQL ────────────────────────────────────────
echo [INFO] Duke ndezur PostgreSQL...
docker compose -f docker-compose.dev.yml up -d db

:: Prit 15 sekonda per DB
echo [INFO] Duke pritur PostgreSQL te behet gati...
set /a counter=0
:wait_db
set /a counter+=1
if %counter% gtr 30 (
  echo [ERR] PostgreSQL nuk u ndez. Kontrollo Docker.
  pause
  exit /b 1
)
docker exec jurist_db_dev pg_isready -U jurist -q >nul 2>&1
if %errorlevel% neq 0 (
  timeout /t 1 /nobreak >nul
  goto wait_db
)
echo [OK] PostgreSQL gati

:: ── 5. Seed (here e pare) ─────────────────────────────────────
if defined FIRST_RUN (
  echo [INFO] Duke ekzekutuar seed...
  set DATABASE_URL=postgresql+psycopg2://jurist:jurist@localhost:5432/jurist
  cd backend
  .venv\Scripts\python seed.py
  if %errorlevel% neq 0 echo [WARN] Seed deshtoi ose eshte ekzekutuar me pare
  cd ..
  echo [OK] Seed u ekzekutua
)

:: ── 6. Nise backend ───────────────────────────────────────────
echo [INFO] Duke ndezur backend (port 8000)...
if not exist "backend\uploads" mkdir "backend\uploads"

set DATABASE_URL=postgresql+psycopg2://jurist:jurist@localhost:5432/jurist
set SECRET_KEY=dev-secret-key-change-in-production
set ENVIRONMENT=development

start "Jurist Backend" /min cmd /c "cd /d %SCRIPT_DIR%backend && .venv\Scripts\uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Prit backend
set /a counter=0
:wait_backend
set /a counter+=1
if %counter% gtr 20 (
  echo [ERR] Backend nuk u ndez.
  pause
  exit /b 1
)
curl -sf http://localhost:8000/health >nul 2>&1
if %errorlevel% neq 0 (
  timeout /t 1 /nobreak >nul
  goto wait_backend
)
echo [OK] Backend gati

:: ── 7. Nise frontend ──────────────────────────────────────────
echo [INFO] Duke ndezur frontend (port 5173)...
start "Jurist Frontend" /min cmd /c "npm run dev --prefix %SCRIPT_DIR%frontend -- --host 0.0.0.0 --port 5173"

timeout /t 4 /nobreak >nul
echo [OK] Frontend gati

:: ── 8. Hap shfletuesin ────────────────────────────────────────
echo [INFO] Duke hapur shfletuesin...
start "" http://localhost:5173

:: ── 9. Mesazhi final ──────────────────────────────────────────
echo.
echo   ════════════════════════════════════════════════════
echo    Jurist Pro eshte aktiv!
echo   ════════════════════════════════════════════════════
echo.
echo     Frontend :  http://localhost:5173
echo     Backend  :  http://localhost:8000
echo     API Docs :  http://localhost:8000/docs
echo.
echo     Login    :  admin@jurist.al  /  Admin123!
echo.
echo   Mos e mbyll kete dritare – mbyll direkt shfletuesin
echo   kur te perfundosh, pastaj mbyll kete dritare.
echo.
pause
