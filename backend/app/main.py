import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler: run startup tasks before serving, cleanup on shutdown."""
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
    description=(
        "Backend API for Jurist — an Albanian public procurement document management platform. "
        "Manage company document vaults, sync procurement procedures from APP portal, "
        "run AI analysis and document matching."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
# In development allow all origins; tighten this in production via env config.
origins = ["*"] if settings.ENVIRONMENT == "development" else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.api.routes import auth, companies, folders, documents, procedures, analyses, matching, admin  # noqa: E402

API_PREFIX = "/api"

app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(companies.router, prefix=API_PREFIX)
app.include_router(folders.router, prefix=API_PREFIX)
app.include_router(documents.router, prefix=API_PREFIX)
app.include_router(procedures.router, prefix=API_PREFIX)
app.include_router(analyses.router, prefix=API_PREFIX)
app.include_router(matching.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


# ---------------------------------------------------------------------------
# Utility endpoints
# ---------------------------------------------------------------------------

@app.get("/health", tags=["health"], summary="Health check")
def health_check() -> dict:
    """Return a simple OK response to confirm the service is running."""
    return {"status": "ok", "service": "jurist-api", "version": "1.0.0"}


@app.get("/", tags=["root"], summary="API root")
def root() -> dict:
    """Root endpoint with links to the API documentation."""
    return {
        "message": "Mirësevini në Jurist API",
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
    }
