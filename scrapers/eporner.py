import urllib.parse
import aiohttp
from .base import BaseScraper, VideoResult

# Eporner has a public JSON API — more reliable than HTML scraping
_API = "https://www.eporner.com/api/v2/video/search/"


class EpornerScraper(BaseScraper):
    site_name = "Eporner"
    base_url = "https://www.eporner.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        results = []
        for page in [1, 2]:
            params = {
                "query": query,
                "per_page": "30",
                "page": str(page),
                "thumbsize": "medium",
                "order": "top-rated",
                "format": "json",
                "gay": "0",
                "site": "eporner",
            }
            url = _API + "?" + urllib.parse.urlencode(params)
            try:
                async with session.get(
                    url,
                    headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
                    timeout=aiohttp.ClientTimeout(total=12),
                ) as resp:
                    if resp.status != 200:
                        break
                    data = await resp.json(content_type=None)
                    videos = data.get("videos", [])
                    if not videos:
                        break
                    for v in videos:
                        results.append(VideoResult(
                            title=v.get("title", ""),
                            url=self.base_url + v.get("url", ""),
                            thumbnail=v.get("default_thumb", {}).get("src", ""),
                            duration=v.get("duration", ""),
                            site=self.site_name,
                            views=str(v.get("views", "")),
                            rating=str(v.get("rate", "")),
                        ))
            except Exception:
                break
        return results
