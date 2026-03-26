import re
import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

PROCEDURE_TYPE_MAP = {
    "procedurë e hapur": "Procedurë e Hapur",
    "procedure e hapur": "Procedurë e Hapur",
    "open procedure": "Procedurë e Hapur",
    "procedurë e kufizuar": "Procedurë e Kufizuar",
    "restricted procedure": "Procedurë e Kufizuar",
    "procedurë me negocim": "Procedurë me Negocim",
    "negotiated procedure": "Procedurë me Negocim",
    "vlere te vogel": "Prokurim me Vlerë të Vogël",
    "vlerë të vogël": "Prokurim me Vlerë të Vogël",
    "small value": "Prokurim me Vlerë të Vogël",
    "kuotim çmimi": "Kuotim Çmimi",
    "price quotation": "Kuotim Çmimi",
}

CURRENCY_MAP = {
    "lekë": "ALL",
    "lek": "ALL",
    "all": "ALL",
    "euro": "EUR",
    "eur": "EUR",
    "usd": "USD",
    "dollar": "USD",
}


class AppGovNormalizer:
    """Normalize raw scraped data from APP.gov.al into structured format."""

    def normalize_procedure(self, raw_data: dict) -> dict:
        """Normalize a raw procedure dict into clean structured data."""
        normalized = {}

        # Source URL
        normalized["source_url"] = self._clean_url(raw_data.get("source_url", ""))

        # Text fields
        normalized["object_description"] = self._clean_text(raw_data.get("object_description", ""), max_len=2000)
        normalized["authority_name"] = self._clean_text(raw_data.get("authority_name", ""), max_len=512)
        normalized["reference_no"] = self._clean_text(raw_data.get("reference_no", ""), max_len=255)
        normalized["notice_no"] = self._clean_text(raw_data.get("notice_no", ""), max_len=255)
        normalized["cpv_code"] = self._clean_cpv(raw_data.get("cpv_code", ""))
        normalized["currency"] = self._normalize_currency(raw_data.get("currency", "ALL"))

        # Procedure type
        normalized["procedure_type"] = self.detect_procedure_type(
            raw_data.get("procedure_type", "") or raw_data.get("raw_text", "")
        )

        # Contract type
        normalized["contract_type"] = self._clean_text(raw_data.get("contract_type", ""), max_len=100)

        # Fund limit
        normalized["fund_limit"] = self.normalize_fund(raw_data.get("fund_limit", ""))

        # Dates
        normalized["publication_date"] = self.normalize_date(raw_data.get("publication_date", ""))
        normalized["opening_date"] = self.normalize_date(raw_data.get("opening_date", ""))
        normalized["closing_date"] = self.normalize_date(raw_data.get("closing_date", ""))

        # Document links
        normalized["document_links"] = raw_data.get("document_links", [])

        # Raw data
        normalized["raw_json"] = {k: v for k, v in raw_data.items() if k not in ("raw_html", "raw_text")}

        return normalized

    def normalize_date(self, date_str: Optional[str]) -> Optional[date]:
        """Parse various Albanian date formats."""
        if not date_str or not isinstance(date_str, str):
            return None

        date_str = date_str.strip()

        # Try ISO format first
        iso_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', date_str)
        if iso_match:
            try:
                return date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))
            except ValueError:
                pass

        # Try DD.MM.YYYY or DD/MM/YYYY
        dmy_match = re.match(r'^(\d{1,2})[./](\d{1,2})[./](\d{4})$', date_str)
        if dmy_match:
            try:
                return date(int(dmy_match.group(3)), int(dmy_match.group(2)), int(dmy_match.group(1)))
            except ValueError:
                pass

        # Try YYYY/MM/DD
        ymd_match = re.match(r'^(\d{4})/(\d{2})/(\d{2})$', date_str)
        if ymd_match:
            try:
                return date(int(ymd_match.group(1)), int(ymd_match.group(2)), int(ymd_match.group(3)))
            except ValueError:
                pass

        # Extract first date-like pattern from string
        match = re.search(r'(\d{1,2})[./](\d{1,2})[./](\d{4})', date_str)
        if match:
            try:
                return date(int(match.group(3)), int(match.group(2)), int(match.group(1)))
            except ValueError:
                pass

        logger.debug(f"Could not parse date: {date_str}")
        return None

    def normalize_fund(self, amount_str: Optional[str]) -> Optional[float]:
        """Parse fund amount from various formats."""
        if not amount_str:
            return None
        if isinstance(amount_str, (int, float)):
            return float(amount_str)

        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[^\d.,]', '', str(amount_str))
        if not cleaned:
            return None

        # Handle European number format (1.234.567,89 or 1,234,567.89)
        if ',' in cleaned and '.' in cleaned:
            # Determine which is thousands and which is decimal
            last_comma = cleaned.rfind(',')
            last_dot = cleaned.rfind('.')
            if last_comma > last_dot:
                # European: 1.234,56
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                # US: 1,234.56
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Could be decimal comma: 1234,56 or thousands: 1,234
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                cleaned = cleaned.replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        # else just dots (thousands): 1.234.567 -> remove dots
        elif cleaned.count('.') > 1:
            cleaned = cleaned.replace('.', '')

        try:
            return float(cleaned)
        except ValueError:
            return None

    def detect_procedure_type(self, text: str) -> Optional[str]:
        """Detect procedure type from text."""
        if not text:
            return None
        text_lower = text.lower()
        for key, value in PROCEDURE_TYPE_MAP.items():
            if key in text_lower:
                return value
        return None

    def _clean_text(self, text: Optional[str], max_len: int = 500) -> Optional[str]:
        if not text or not isinstance(text, str):
            return None
        cleaned = re.sub(r'\s+', ' ', text).strip()
        return cleaned[:max_len] if cleaned else None

    def _clean_url(self, url: Optional[str]) -> Optional[str]:
        if not url:
            return None
        url = url.strip()
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = "https://www.app.gov.al" + url
        return url[:2048]

    def _clean_cpv(self, cpv: Optional[str]) -> Optional[str]:
        if not cpv:
            return None
        # CPV codes are like 45000000-7 or 45000000
        match = re.search(r'\d{8}(-\d)?', str(cpv))
        if match:
            return match.group(0)
        return self._clean_text(cpv, max_len=50)

    def _normalize_currency(self, currency: Optional[str]) -> str:
        if not currency:
            return "ALL"
        lower = str(currency).lower().strip()
        return CURRENCY_MAP.get(lower, "ALL")
