import asyncio
import logging
from typing import Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "sq,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

MAX_RETRIES = 3
RETRY_DELAY = 2.0
REQUEST_TIMEOUT = 30.0


class AppGovCrawler:
    def __init__(self):
        self.client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            headers=DEFAULT_HEADERS,
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
            verify=False,  # APP.gov.al sometimes has SSL issues
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()

    async def fetch_html(self, url: str, retries: int = MAX_RETRIES) -> Optional[str]:
        """Fetch HTML content from a URL with retry logic."""
        for attempt in range(1, retries + 1):
            try:
                logger.info(f"Fetching URL (attempt {attempt}/{retries}): {url}")
                if self.client is None:
                    self.client = httpx.AsyncClient(
                        headers=DEFAULT_HEADERS,
                        timeout=REQUEST_TIMEOUT,
                        follow_redirects=True,
                        verify=False,
                    )
                response = await self.client.get(url)
                response.raise_for_status()
                return response.text
            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP error {e.response.status_code} for {url}")
                if e.response.status_code in (404, 410):
                    return None
                if attempt < retries:
                    await asyncio.sleep(RETRY_DELAY * attempt)
            except httpx.RequestError as e:
                logger.warning(f"Request error for {url}: {e}")
                if attempt < retries:
                    await asyncio.sleep(RETRY_DELAY * attempt)
            except Exception as e:
                logger.error(f"Unexpected error fetching {url}: {e}")
                if attempt < retries:
                    await asyncio.sleep(RETRY_DELAY)
        logger.error(f"Failed to fetch {url} after {retries} attempts")
        return None

    async def fetch_listing_pages(
        self,
        base_url: str,
        max_pages: int = 5,
    ) -> list[tuple[int, str]]:
        """Fetch multiple listing pages. Returns list of (page_num, html)."""
        results = []
        for page in range(1, max_pages + 1):
            if page == 1:
                url = base_url
            else:
                # APP.gov.al uses ?paged=N for pagination
                separator = "&" if "?" in base_url else "?"
                url = f"{base_url}{separator}paged={page}"

            html = await self.fetch_html(url)
            if html:
                results.append((page, html))
                # Check if there are more pages
                if "next" not in html.lower() and page > 1:
                    break
                await asyncio.sleep(0.5)  # Be polite
            else:
                break
        return results

    async def fetch_detail_page(self, detail_url: str) -> Optional[str]:
        """Fetch a procedure detail page."""
        return await self.fetch_html(detail_url)

    async def fetch_binary(self, url: str) -> Optional[bytes]:
        """Download binary content (PDF, DOCX, etc.)."""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                if self.client is None:
                    self.client = httpx.AsyncClient(
                        headers=DEFAULT_HEADERS,
                        timeout=60.0,
                        follow_redirects=True,
                        verify=False,
                    )
                response = await self.client.get(url)
                response.raise_for_status()
                return response.content
            except Exception as e:
                logger.warning(f"Binary fetch attempt {attempt} failed for {url}: {e}")
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY)
        return None
