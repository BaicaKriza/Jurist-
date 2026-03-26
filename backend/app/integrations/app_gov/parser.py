import logging
import re
from typing import Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class AppGovParser:
    """Parser for APP.gov.al procurement notices."""

    def parse_contract_notices(self, html: str) -> list[dict]:
        """Parse listing page of contract notices."""
        soup = BeautifulSoup(html, "lxml")
        procedures = []

        # Look for article/post entries that contain procedure links
        entries = soup.find_all(["article", "div"], class_=re.compile(r"post|entry|item|notice", re.I))
        if not entries:
            # Fallback: look for table rows
            entries = soup.find_all("tr")

        for entry in entries:
            try:
                proc = self._extract_listing_item(entry)
                if proc:
                    procedures.append(proc)
            except Exception as e:
                logger.debug(f"Could not parse entry: {e}")

        # Also try to extract from tables
        if not procedures:
            procedures = self._parse_table_listing(soup)

        logger.info(f"Parsed {len(procedures)} contract notices from HTML")
        return procedures

    def parse_small_value_procedures(self, html: str) -> list[dict]:
        """Parse listing page of small value procedures."""
        return self.parse_contract_notices(html)

    def _extract_listing_item(self, element) -> Optional[dict]:
        """Extract procedure data from a listing item."""
        # Find the main link
        link = element.find("a", href=True)
        if not link:
            return None

        href = link.get("href", "")
        if not href or "app.gov.al" not in href and not href.startswith("/"):
            # Try to find any meaningful link
            links = element.find_all("a", href=True)
            for l in links:
                h = l.get("href", "")
                if h and len(h) > 5:
                    href = h
                    link = l
                    break

        if not href:
            return None

        title = link.get_text(strip=True)
        if not title:
            title = element.get_text(strip=True)[:200]

        # Extract text content
        text = element.get_text(" ", strip=True)

        # Try to extract dates from text
        pub_date = self._extract_date_from_text(text)

        # Try to extract authority
        authority = self._extract_authority_from_text(text)

        return {
            "source_url": href,
            "object_description": title,
            "authority_name": authority,
            "publication_date": pub_date,
            "raw_text": text[:2000],
        }

    def _parse_table_listing(self, soup: BeautifulSoup) -> list[dict]:
        """Parse procedures from a table-based layout."""
        procedures = []
        tables = soup.find_all("table")
        for table in tables:
            headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
            rows = table.find_all("tr")[1:]  # Skip header row
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) < 2:
                    continue
                proc = {}
                link = row.find("a", href=True)
                if link:
                    proc["source_url"] = link.get("href", "")
                    proc["object_description"] = link.get_text(strip=True)
                text = row.get_text(" ", strip=True)
                proc["publication_date"] = self._extract_date_from_text(text)
                proc["authority_name"] = cells[0].get_text(strip=True) if cells else None
                proc["raw_text"] = text[:2000]
                if proc.get("source_url"):
                    procedures.append(proc)
        return procedures

    def parse_procedure_detail(self, html: str, source_url: str = "") -> dict:
        """Parse a procedure detail page."""
        soup = BeautifulSoup(html, "lxml")
        data = {
            "source_url": source_url,
            "document_links": [],
        }

        # Extract title / object description
        title_el = (
            soup.find("h1")
            or soup.find("h2")
            or soup.find(class_=re.compile(r"title|heading", re.I))
        )
        if title_el:
            data["object_description"] = title_el.get_text(strip=True)

        # Try to find all relevant fields from definition lists or tables
        self._extract_detail_fields(soup, data)

        # Extract document links
        data["document_links"] = self._extract_document_links(soup)

        # Store raw HTML snippet
        content_el = soup.find("main") or soup.find("article") or soup.find(id=re.compile(r"content|main", re.I))
        if content_el:
            data["raw_text"] = content_el.get_text(" ", strip=True)[:5000]
        else:
            data["raw_text"] = soup.get_text(" ", strip=True)[:5000]

        return data

    def _extract_detail_fields(self, soup: BeautifulSoup, data: dict) -> None:
        """Extract structured fields from detail page."""
        # Look for key-value pairs in various HTML structures
        field_patterns = {
            "authority_name": ["autoriteti kontraktor", "autoriteti", "entit", "kontraktor"],
            "reference_no": ["numri i referencës", "ref", "nr.ref", "referenca"],
            "notice_no": ["numri i njoftimit", "nr.njoftimit", "njoftimi"],
            "procedure_type": ["lloji i procedurës", "procedura", "lloji"],
            "contract_type": ["lloji i kontratës", "kontrata"],
            "cpv_code": ["kodi cpv", "cpv"],
            "fund_limit": ["kufiri i fondit", "fondi limit", "vlera"],
            "currency": ["monedha", "currency"],
            "publication_date": ["data e publikimit", "publikuar"],
            "opening_date": ["data e hapjes", "hapja"],
            "closing_date": ["afati i dorëzimit", "data e mbylljes", "mbyllja"],
        }

        # Try dt/dd pairs
        for dl in soup.find_all("dl"):
            terms = dl.find_all("dt")
            defs = dl.find_all("dd")
            for dt, dd in zip(terms, defs):
                term = dt.get_text(strip=True).lower()
                value = dd.get_text(strip=True)
                self._match_field(term, value, field_patterns, data)

        # Try table rows (label: value)
        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                term = cells[0].get_text(strip=True).lower()
                value = cells[1].get_text(strip=True)
                self._match_field(term, value, field_patterns, data)

        # Try strong/span label patterns
        for strong in soup.find_all(["strong", "b", "label"]):
            term = strong.get_text(strip=True).lower()
            # Get the next sibling text
            sibling = strong.find_next_sibling()
            if sibling:
                value = sibling.get_text(strip=True)
                self._match_field(term, value, field_patterns, data)
            elif strong.parent:
                parent_text = strong.parent.get_text(strip=True)
                value = parent_text.replace(strong.get_text(strip=True), "").strip(": \t")
                self._match_field(term, value, field_patterns, data)

    def _match_field(self, term: str, value: str, patterns: dict, data: dict) -> None:
        """Match a term against known field patterns."""
        if not value or len(value) > 1000:
            return
        for field, keywords in patterns.items():
            if field not in data or not data[field]:
                for kw in keywords:
                    if kw in term:
                        data[field] = value
                        break

    def _extract_document_links(self, soup: BeautifulSoup) -> list[dict]:
        """Extract links to downloadable documents."""
        doc_links = []
        seen_urls = set()

        for a in soup.find_all("a", href=True):
            href = a.get("href", "")
            if not href or href in seen_urls:
                continue

            # Check if it looks like a document URL
            lower_href = href.lower()
            is_doc = any(
                ext in lower_href
                for ext in [".pdf", ".doc", ".docx", ".xlsx", ".xls", ".zip", ".rar", "download", "file"]
            )
            if is_doc or "app.gov.al" in lower_href:
                title = a.get_text(strip=True) or a.get("title", "") or href.split("/")[-1]
                doc_links.append({
                    "url": href,
                    "title": title[:255],
                })
                seen_urls.add(href)

        return doc_links

    def _extract_date_from_text(self, text: str) -> Optional[str]:
        """Extract a date string from text."""
        # Albanian date patterns: DD.MM.YYYY or DD/MM/YYYY
        patterns = [
            r'\b(\d{2}[./]\d{2}[./]\d{4})\b',
            r'\b(\d{4}-\d{2}-\d{2})\b',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        return None

    def _extract_authority_from_text(self, text: str) -> Optional[str]:
        """Try to extract authority name from text."""
        # Look for patterns like "Autoriteti: ..."
        match = re.search(r'autoritet[i]?\s*[:–-]\s*([^\n,;]{5,80})', text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None
