"""
Storage abstraction: MinIO primary, local filesystem fallback.

When MinIO is unavailable (connection refused, no env config), all operations
fall back to a local directory at STORAGE_LOCAL_PATH (default: ./uploads).
The fallback is transparent to callers – same function signatures.
"""
import io
import os
import logging
from pathlib import Path
from typing import Optional, BinaryIO

from app.core.config import settings

logger = logging.getLogger(__name__)

# Local fallback directory
_LOCAL_STORAGE_ROOT = Path(os.getenv("STORAGE_LOCAL_PATH", "./uploads"))

# Cached MinIO client; None means not yet initialized; False means failed
_minio_client = None
_minio_available: Optional[bool] = None


# ---------------------------------------------------------------------------
# MinIO helpers
# ---------------------------------------------------------------------------

def _get_minio_client():
    global _minio_client, _minio_available
    if _minio_available is False:
        return None
    if _minio_client is not None:
        return _minio_client
    try:
        from minio import Minio
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
        # Lightweight ping
        client.list_buckets()
        _minio_client = client
        _minio_available = True
        logger.info("MinIO storage: connected")
        return _minio_client
    except Exception as e:
        _minio_available = False
        logger.warning(
            f"MinIO unavailable ({e}) – falling back to local storage at {_LOCAL_STORAGE_ROOT}"
        )
        return None


def _ensure_bucket(client, bucket_name: str) -> None:
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            logger.info(f"Created MinIO bucket: {bucket_name}")
    except Exception as e:
        logger.error(f"MinIO bucket error: {e}")
        raise


# ---------------------------------------------------------------------------
# Local filesystem helpers
# ---------------------------------------------------------------------------

def _local_path(object_name: str) -> Path:
    p = _LOCAL_STORAGE_ROOT / object_name
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def upload_file(
    file_data: bytes,
    object_name: str,
    content_type: str = "application/octet-stream",
    bucket_name: Optional[str] = None,
) -> str:
    """Upload bytes to MinIO (or local fallback). Returns object_name."""
    client = _get_minio_client()
    if client is not None:
        bucket = bucket_name or settings.MINIO_BUCKET
        try:
            _ensure_bucket(client, bucket)
            client.put_object(
                bucket, object_name, io.BytesIO(file_data),
                length=len(file_data), content_type=content_type,
            )
            logger.debug(f"[MinIO] uploaded {object_name}")
            return object_name
        except Exception as e:
            logger.warning(f"MinIO upload failed ({e}), falling back to local storage")

    # Local fallback
    path = _local_path(object_name)
    path.write_bytes(file_data)
    logger.debug(f"[Local] uploaded {object_name} -> {path}")
    return object_name


def upload_file_stream(
    file_stream: BinaryIO,
    object_name: str,
    file_size: int,
    content_type: str = "application/octet-stream",
    bucket_name: Optional[str] = None,
) -> str:
    """Upload a stream. Returns object_name."""
    data = file_stream.read()
    return upload_file(data, object_name, content_type=content_type, bucket_name=bucket_name)


def get_file_url(
    object_name: str,
    expires_seconds: int = 3600,
    bucket_name: Optional[str] = None,
) -> str:
    """Return a presigned URL (MinIO) or a local download path (fallback)."""
    client = _get_minio_client()
    if client is not None:
        bucket = bucket_name or settings.MINIO_BUCKET
        try:
            from datetime import timedelta
            url = client.presigned_get_object(
                bucket, object_name, expires=timedelta(seconds=expires_seconds)
            )
            return url
        except Exception as e:
            logger.warning(f"MinIO presign failed ({e}), returning local path")

    # Local fallback: encode the path so the download endpoint can serve it
    import urllib.parse
    encoded = urllib.parse.quote(object_name, safe="")
    return f"/api/storage/local/{encoded}"


def get_file_bytes(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bytes:
    """Download file bytes from MinIO or local storage."""
    client = _get_minio_client()
    if client is not None:
        bucket = bucket_name or settings.MINIO_BUCKET
        try:
            response = client.get_object(bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except Exception as e:
            logger.warning(f"MinIO download failed ({e}), trying local storage")

    path = _local_path(object_name)
    if path.exists():
        return path.read_bytes()
    raise FileNotFoundError(f"File not found in local storage: {object_name}")


def delete_file(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bool:
    """Delete from MinIO and/or local storage."""
    deleted = False

    client = _get_minio_client()
    if client is not None:
        bucket = bucket_name or settings.MINIO_BUCKET
        try:
            client.remove_object(bucket, object_name)
            deleted = True
        except Exception as e:
            logger.warning(f"MinIO delete failed ({e})")

    path = _local_path(object_name)
    if path.exists():
        path.unlink()
        deleted = True

    return deleted


def file_exists(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bool:
    """Check if a file exists in MinIO or local storage."""
    client = _get_minio_client()
    if client is not None:
        bucket = bucket_name or settings.MINIO_BUCKET
        try:
            client.stat_object(bucket, object_name)
            return True
        except Exception:
            pass

    return _local_path(object_name).exists()
