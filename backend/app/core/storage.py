import io
import os
from typing import Optional, BinaryIO
from minio import Minio
from minio.error import S3Error
from fastapi import HTTPException, status
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

_minio_client: Optional[Minio] = None


def get_minio_client() -> Minio:
    global _minio_client
    if _minio_client is None:
        _minio_client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_USE_SSL,
        )
    return _minio_client


def ensure_bucket_exists(client: Minio, bucket_name: str) -> None:
    try:
        if not client.bucket_exists(bucket_name):
            client.make_bucket(bucket_name)
            logger.info(f"Created MinIO bucket: {bucket_name}")
    except S3Error as e:
        logger.error(f"MinIO bucket error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage configuration error: {e}",
        )


def upload_file(
    file_data: bytes,
    object_name: str,
    content_type: str = "application/octet-stream",
    bucket_name: Optional[str] = None,
) -> str:
    """Upload file bytes to MinIO and return the object name."""
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET
    ensure_bucket_exists(client, bucket)

    try:
        file_stream = io.BytesIO(file_data)
        client.put_object(
            bucket,
            object_name,
            file_stream,
            length=len(file_data),
            content_type=content_type,
        )
        logger.info(f"Uploaded file to MinIO: {object_name}")
        return object_name
    except S3Error as e:
        logger.error(f"MinIO upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {e}",
        )


def upload_file_stream(
    file_stream: BinaryIO,
    object_name: str,
    file_size: int,
    content_type: str = "application/octet-stream",
    bucket_name: Optional[str] = None,
) -> str:
    """Upload a file stream to MinIO."""
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET
    ensure_bucket_exists(client, bucket)

    try:
        client.put_object(
            bucket,
            object_name,
            file_stream,
            length=file_size,
            content_type=content_type,
        )
        logger.info(f"Uploaded stream to MinIO: {object_name}")
        return object_name
    except S3Error as e:
        logger.error(f"MinIO stream upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {e}",
        )


def get_file_url(
    object_name: str,
    expires_seconds: int = 3600,
    bucket_name: Optional[str] = None,
) -> str:
    """Get a presigned URL for the given object."""
    from datetime import timedelta
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET

    try:
        url = client.presigned_get_object(
            bucket,
            object_name,
            expires=timedelta(seconds=expires_seconds),
        )
        return url
    except S3Error as e:
        logger.error(f"MinIO presign error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not generate download URL: {e}",
        )


def get_file_bytes(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bytes:
    """Download file from MinIO and return as bytes."""
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET

    try:
        response = client.get_object(bucket, object_name)
        data = response.read()
        response.close()
        response.release_conn()
        return data
    except S3Error as e:
        logger.error(f"MinIO download error: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found: {e}",
        )


def delete_file(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bool:
    """Delete a file from MinIO."""
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET

    try:
        client.remove_object(bucket, object_name)
        logger.info(f"Deleted file from MinIO: {object_name}")
        return True
    except S3Error as e:
        logger.error(f"MinIO delete error: {e}")
        return False


def file_exists(
    object_name: str,
    bucket_name: Optional[str] = None,
) -> bool:
    """Check if a file exists in MinIO."""
    client = get_minio_client()
    bucket = bucket_name or settings.MINIO_BUCKET

    try:
        client.stat_object(bucket, object_name)
        return True
    except S3Error:
        return False
