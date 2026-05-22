import urllib.parse
import aiohttp
from .base import BaseScraper, VideoResult


class PornHubScraper(BaseScraper):
    site_name = "PornHub"
    base_url = "https://www.pornhub.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        results = []
        for page in [1, 2]:
            encoded = urllib.parse.quote_plus(query)
            url = f"{self.base_url}/webmasters/search?search={encoded}&per_page=20&page={page}&ordering=mostviewed"
            try:
                async with session.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                }, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                    if resp.status != 200:
                        break
                    data = await resp.json(content_type=None)
                    videos = data.get("videos", [])
                    if not videos:
                        break
                    for v in videos:
                        results.append(VideoResult(
                            title=v.get("title", ""),
                            url=v.get("url", ""),
                            thumbnail=v.get("thumb", ""),
                            duration=v.get("duration", ""),
                            site=self.site_name,
                            views=str(v.get("views", "")),
                            rating=str(v.get("rating", "")),
                        ))
            except Exception:
                break
        return results
