# Jurist

Platformë e menaxhimit të dokumenteve dhe analizës së procedurave të prokurimit publik shqiptar.

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 + TypeScript + Vite |
| Backend   | FastAPI + SQLAlchemy 2.0 |
| Database  | PostgreSQL 15 |
| Storage   | MinIO (fallback: ./uploads/) |
| Cache     | Redis |
| AI        | OpenAI gpt-4o-mini (fallback: mock) |

## Prerequisites

- Node.js 20+ & npm 10+
- Python 3.11+
- PostgreSQL 15+ running locally (or Docker)

## Quick start (1 komandë)

```bash
# 1. Clone
git clone https://github.com/BaicaKriza/Jurist-.git
cd Jurist-

# 2. Instalo dependencies (frontend + backend)
npm install
npm run install:all

# 3. Konfiguro .env te backend
cp .env.example backend/.env
# Edito backend/.env nëse DATABASE_URL është ndryshe

# 4. Seed admin user
npm run seed
# If login already existed with an old password during local testing:
# RESET_ADMIN_PASSWORD=true npm run seed

# 5. Ndiz projektin
npm run dev
```

Frontend → http://localhost:5173  
Backend  → http://localhost:8000  
API Docs → http://localhost:8000/docs

## Kredencialet default

```
email:    admin@jurist.al
password: Admin123!
```

## Komanda

| Komanda | Përshkrim |
|---------|-----------|
| `npm run dev` | Ndiz backend + frontend bashkë |
| `npm run dev:backend` | Vetëm backend (port 8000) |
| `npm run dev:frontend` | Vetëm frontend (port 5173) |
| `npm run seed` | Krijo superadmin + roles |
| `npm run build` | Build frontend për production |
| `npm run install:all` | Instalo npm + pip dependencies |

## Docker Compose (alternativë)

```bash
docker compose up --build
```

Ngre: postgres, redis, minio, backend, frontend, nginx.

## Codespaces / Cloud Dev

Kur punon në GitHub Codespaces:

1. Ndiz `npm run dev` nga root
2. Frontend del te porta **5173** → klik "Open in Browser" nga VS Code
3. Backend del te porta **8000**
4. Nëse frontend s'godet backend, shto te `frontend/.env.development`:
   ```
   VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
   ```
5. Sigurohu që porta 8000 është e hapur (Ports tab në VS Code)

## Environment Variables

Kopjo `.env.example` → `backend/.env` dhe ndrysho sipas nevojës.

Variablat kryesore:

| Variable | Default | Përshkrim |
|----------|---------|-----------|
| `DATABASE_URL` | `...@localhost:5432/jurist` | PostgreSQL connection string |
| `SECRET_KEY` | dev key | JWT signing key |
| `OPENAI_API_KEY` | (bosh) | Nëse mungon, analiza është mock |
| `RESET_ADMIN_PASSWORD` | `false` | Local only: set `true` before `npm run seed` to repair the default admin password |
| `VITE_BACKEND_PROXY_TARGET` | `http://127.0.0.1:8000` | Proxy target Vite |

## Ports

| Port | Shërbimi |
|------|----------|
| 5173 | Frontend (Vite dev) |
| 8000 | Backend (FastAPI) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 9000 | MinIO API |
| 9001 | MinIO Console |

## Troubleshooting

**`npm install` dështon në root:**  
Sigurohu që je te root i projektit (ku është ky README).

**Login ngec në loading:**  
Backend nuk është ndezur. Kontrollo: `curl http://localhost:8000/health`  
Nëse database s'ekziston: krijo DB `jurist` dhe user `jurist`.

**Database connection refused:**  
Default config pret PostgreSQL te `localhost:5432`.  
Për Docker Compose, vendos `DATABASE_URL=...@db:5432/jurist` te `backend/.env`.

**MinIO errors:**  
MinIO është opsional. Pa të, dokumentet ruhen te `backend/uploads/`.

**Analiza mock:**  
Pa `OPENAI_API_KEY`, sistemi kthen analizë të simuluar. Kjo është OK për dev.
