import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.core.database import create_tables

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up Jurist API...")
    try:
        create_tables()
        logger.info("Database tables verified/created.")
    except Exception as e:
        logger.error(f"Startup error during create_tables: {e}")
    yield
    logger.info("Shutting down Jurist API.")


app = FastAPI(
    title="Jurist API",
    description="Backend API for Jurist - Albanian public procurement document management.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    origins = ["*"]

for local in ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]:
    if local not in origins:
        origins.append(local)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


from app.api.routes import auth, companies, folders, documents, procedures, analyses, matching, admin, chat  # noqa: E402

API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(companies.router, prefix=API_PREFIX)
app.include_router(folders.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(procedures.router, prefix=API_PREFIX)
app.include_router(analyses.router, prefix=API_PREFIX)
app.include_router(matching.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)
app.include_router(chat.router, prefix=f"{API_PREFIX}/chat", tags=["chat"])

app.include_router(auth.router, prefix="", include_in_schema=False)
app.include_router(companies.router, prefix="", include_in_schema=False)
app.include_router(folders.router, prefix="", include_in_schema=False)
app.include_router(documents.router, prefix="", include_in_schema=False)
app.include_router(procedures.router, prefix="", include_in_schema=False)
app.include_router(analyses.router, prefix="", include_in_schema=False)
app.include_router(matching.router, prefix="", include_in_schema=False)
app.include_router(admin.router, prefix="", include_in_schema=False)
app.include_router(chat.router, prefix="/chat", tags=["chat-direct"], include_in_schema=False)


import urllib.parse as _urlparse
from fastapi.responses import FileResponse as _FileResponse


@app.get("/api/storage/local/{object_path:path}", tags=["storage"], include_in_schema=False)
def serve_local_file(object_path: str):
    from app.core.storage import _LOCAL_STORAGE_ROOT
    decoded = _urlparse.unquote(object_path)
    file_path = _LOCAL_STORAGE_ROOT / decoded
    if not file_path.exists() or not file_path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    try:
        file_path.resolve().relative_to(_LOCAL_STORAGE_ROOT.resolve())
    except ValueError:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid path")
    return _FileResponse(str(file_path))


@app.get("/health", tags=["health"], summary="Health check")
def health_check() -> dict:
    return {"status": "ok", "service": "jurist-api", "version": "1.0.0"}


@app.get("/", tags=["root"], summary="API root")
def root() -> dict:
    return {
        "message": "Miresevini ne Jurist API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }
