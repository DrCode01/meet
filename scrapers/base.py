from dataclasses import dataclass, field
from typing import Optional
import aiohttp
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


@dataclass
class VideoResult:
    title: str
    url: str
    thumbnail: str
    duration: str
    site: str
    views: str = ""
    rating: str = ""
    tags: list[str] = field(default_factory=list)


class BaseScraper:
    site_name: str = ""
    base_url: str = ""

    async def fetch(self, session: aiohttp.ClientSession, url: str) -> Optional[str]:
        try:
            async with session.get(url, headers=HEADERS, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status == 200:
                    return await resp.text()
        except Exception:
            pass
        return None

    def parse(self, html: str) -> list[VideoResult]:
        raise NotImplementedError

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        raise NotImplementedError
