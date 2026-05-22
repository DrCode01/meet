from dataclasses import dataclass, field
from typing import Optional
import aiohttp

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
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

    async def fetch(self, session: aiohttp.ClientSession, url: str) -> tuple[int, Optional[str]]:
        try:
            async with session.get(
                url, headers=HEADERS,
                timeout=aiohttp.ClientTimeout(total=15),
                allow_redirects=True,
            ) as resp:
                text = await resp.text(errors="replace")
                return resp.status, text
        except Exception as e:
            return 0, None

    def parse(self, html: str) -> list[VideoResult]:
        raise NotImplementedError

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        raise NotImplementedError
