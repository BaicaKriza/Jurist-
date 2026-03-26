import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class TextExtractor:
    def extract(self, file_path: str, mime_type: str = "") -> Optional[str]:
        ext = Path(file_path).suffix.lower()
        try:
            if ext == ".pdf" or "pdf" in mime_type:
                return self._extract_pdf(file_path)
            elif ext in (".docx", ".doc") or "word" in mime_type:
                return self._extract_docx(file_path)
            elif ext in (".txt",) or "text/plain" in mime_type:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()
        except Exception as e:
            logger.warning(f"Text extraction failed for {file_path}: {e}")
        return None

    def _extract_pdf(self, file_path: str) -> Optional[str]:
        try:
            import pdfplumber
            text_parts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t:
                        text_parts.append(t)
            return "\n".join(text_parts) or None
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            texts = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    texts.append(t)
            return "\n".join(texts) or None
        except Exception as e:
            logger.warning(f"PyPDF2 failed: {e}")
        return None

    def _extract_docx(self, file_path: str) -> Optional[str]:
        try:
            from docx import Document
            doc = Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n".join(paragraphs) or None
        except Exception as e:
            logger.warning(f"docx extraction failed: {e}")
        return None
