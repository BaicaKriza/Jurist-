from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from sqlalchemy.pool import NullPool
from typing import Generator
from app.core.config import settings


class Base(DeclarativeBase):
        pass


engine = create_engine(
        settings.DATABASE_URL,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        echo=settings.ENVIRONMENT == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
        db = SessionLocal()
        try:
                    yield db
finally:
        db.close()


def create_tables():
        """Create all tables - called on startup."""
        from app.models import (  # noqa: F401
            user, role, company, folder, document, procedure, analysis, matching, audit_log
    )
        # Import chat model so its table gets created
        from app.api.routes import chat  # noqa: F401
    Base.metadata.create_all(bind=engine)
