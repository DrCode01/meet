import json
from dataclasses import dataclass, field
from typing import Any, Optional

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

JSON_HEADERS = {
    "User-Agent": HEADERS["User-Agent"],
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": HEADERS["Accept-Language"],
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


@dataclass
class FetchOutcome:
    """What happened on one HTTP request — kept even when it fails, so the UI can say why."""
    url: str
    status: int = 0
    error: str = ""
    count: int = 0
    body: str = ""

    @property
    def body_head(self) -> str:
        """Enough of the response to identify a block page or a changed payload shape."""
        return self.body[:400]

    def as_stat(self) -> dict:
        """Serializable view — drops the body so search responses stay small."""
        return {
            "url": self.url,
            "status": self.status,
            "error": self.error,
            "count": self.count,
        }


@dataclass
class SearchOutcome:
    site: str
    results: list[VideoResult] = field(default_factory=list)
    fetches: list[FetchOutcome] = field(default_factory=list)

    @property
    def error(self) -> str:
        """First thing that went wrong, phrased for a status line."""
        for f in self.fetches:
            if f.error:
                return f.error
            if f.status != 200:
                return f"HTTP {f.status}" if f.status else "no response"
        if not self.results:
            return "0 results"
        return ""


def find_video_list(data: Any, depth: int = 0) -> list[dict]:
    """Pull the first list-of-objects out of a JSON payload.

    The APIs behind these sites are undocumented and move their payload between
    keys (``videos``, ``results``, ``data.videos``…), so match on shape rather
    than trusting one key path.
    """
    if depth > 4:
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)] if data else []
    if not isinstance(data, dict):
        return []
    for key in ("videos", "results", "items", "data", "response", "video"):
        if key in data:
            found = find_video_list(data[key], depth + 1)
            if found:
                return found
    for value in data.values():
        if isinstance(value, (list, dict)):
            found = find_video_list(value, depth + 1)
            if found:
                return found
    return []


def first_str(item: dict, *keys: str, default: str = "") -> str:
    """First non-empty value among ``keys``, stringified."""
    for key in keys:
        value = item.get(key)
        if value not in (None, "", [], {}):
            return str(value)
    return default


class BaseScraper:
    site_name: str = ""
    base_url: str = ""
    json_api: bool = True

    def search_urls(self, query: str) -> list[str]:
        """URLs this scraper hits, in order. Also drives /api/debug."""
        raise NotImplementedError

    def parse(self, body: str) -> list[VideoResult]:
        raise NotImplementedError

    async def fetch(self, session: aiohttp.ClientSession, url: str) -> FetchOutcome:
        headers = JSON_HEADERS if self.json_api else HEADERS
        try:
            async with session.get(
                url,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=15),
                allow_redirects=True,
            ) as resp:
                text = await resp.text(errors="replace")
                return FetchOutcome(url=url, status=resp.status, body=text)
        except Exception as e:
            return FetchOutcome(url=url, error=f"{type(e).__name__}: {e}")

    async def search(self, session: aiohttp.ClientSession, query: str) -> SearchOutcome:
        outcome = SearchOutcome(site=self.site_name)
        for url in self.search_urls(query):
            fetched = await self.fetch(session, url)
            page: list[VideoResult] = []
            if fetched.status == 200 and fetched.body:
                try:
                    page = self.parse(fetched.body)
                except Exception as e:
                    fetched.error = f"parse failed: {type(e).__name__}: {e}"
            fetched.count = len(page)
            outcome.results.extend(page)
            outcome.fetches.append(fetched)
            # Stop paging once a request fails or a page comes back empty.
            if fetched.status != 200 or not page:
                break
        return outcome

    @staticmethod
    def load_json(body: str) -> Any:
        return json.loads(body)
