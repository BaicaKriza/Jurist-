import hashlib
import logging
import os
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.procedure import Procedure, ProcedureDocument
from app.core.storage import upload_file

logger = logging.getLogger(__name__)


class DocumentDownloader:
    def __init__(self, db: Session):
        self.db = db

    async def download_file(self, url: str, target_path: str) -> Optional[bytes]:
        """Download a file from URL, upload to MinIO, return content."""
        from app.integrations.app_gov.crawler import AppGovCrawler
        async with AppGovCrawler() as crawler:
            content = await crawler.fetch_binary(url)
            if not content:
                logger.warning(f"Could not download: {url}")
                return None
            return content

    async def download_procedure_documents(
        self,
        procedure: Procedure,
        proc_docs: list[ProcedureDocument],
    ) -> dict:
        """Download all documents for a procedure and upload to MinIO."""
        downloaded = 0
        failed = 0
        skipped = 0

        for proc_doc in proc_docs:
            if not proc_doc.document_url:
                skipped += 1
                continue

            # Skip already downloaded
            if proc_doc.file_path:
                skipped += 1
                continue

            try:
                content = await self.download_file(proc_doc.document_url, "")
                if not content:
                    failed += 1
                    continue

                # Determine file extension from URL or content type
                url_path = proc_doc.document_url.split("?")[0]
                ext = Path(url_path).suffix.lower() or ".bin"
                if ext not in [".pdf", ".doc", ".docx", ".xlsx", ".xls", ".zip", ".rar"]:
                    ext = ".pdf"

                checksum = hashlib.sha256(content).hexdigest()
                object_name = f"procedures/{procedure.id}/documents/{checksum}{ext}"

                # Upload to MinIO
                upload_file(content, object_name, content_type=self._get_mime(ext))

                # Update DB record
                proc_doc.file_path = object_name
                proc_doc.file_name = proc_doc.file_name or f"{checksum}{ext}"
                proc_doc.checksum = checksum
                proc_doc.mime_type = self._get_mime(ext)

                # Extract text if PDF or DOCX
                try:
                    from app.utils.text_extract import TextExtractor
                    import tempfile
                    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                        tmp.write(content)
                        tmp_path = tmp.name
                    extractor = TextExtractor()
                    text = extractor.extract(tmp_path, self._get_mime(ext))
                    proc_doc.extracted_text = text
                    os.unlink(tmp_path)
                except Exception as e:
                    logger.debug(f"Text extraction failed: {e}")

                self.db.commit()
                downloaded += 1
                logger.info(f"Downloaded procedure document: {proc_doc.title or proc_doc.document_url}")

            except Exception as e:
                logger.error(f"Failed to download {proc_doc.document_url}: {e}")
                failed += 1

        return {
            "downloaded": downloaded,
            "failed": failed,
            "skipped": skipped,
            "total": len(proc_docs),
        }

    def _get_mime(self, ext: str) -> str:
        mime_map = {
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".zip": "application/zip",
            ".rar": "application/x-rar-compressed",
        }
        return mime_map.get(ext.lower(), "application/octet-stream")
