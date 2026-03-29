from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://jurist:jurist@db:5432/jurist"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "jurist-documents"
    MINIO_USE_SSL: bool = False

    REDIS_URL: str = "redis://redis:6379/0"

    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    APP_GOV_NOTICES_URL: str = "https://www.app.gov.al/njoftimi-i-kontrat%C3%ABs-s%C3%AB-shpallur/"
    APP_GOV_SMALL_VALUE_URL: str = "https://www.app.gov.al/prokurimet-me-vlere-te-vogel/"

    ENVIRONMENT: str = "development"
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg"]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
