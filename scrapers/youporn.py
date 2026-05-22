import urllib.parse
import aiohttp
from .base import BaseScraper, VideoResult

# YouPorn public API (same MindGeek network as PornHub)
_API = "https://www.youporn.com/api/v2/video/search/"


class YouPornScraper(BaseScraper):
    site_name = "YouPorn"
    base_url = "https://www.youporn.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        results = []
        for page in [1, 2]:
            params = {
                "query": query,
                "per_page": "30",
                "page": str(page),
            }
            url = _API + "?" + urllib.parse.urlencode(params)
            try:
                async with session.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "application/json",
                        "Referer": "https://www.youporn.com/",
                    },
                    timeout=aiohttp.ClientTimeout(total=12),
                ) as resp:
                    if resp.status != 200:
                        break
                    data = await resp.json(content_type=None)
                    videos = (
                        data.get("videos")
                        or data.get("data", {}).get("videos", [])
                        or []
                    )
                    if not videos:
                        break
                    for v in videos:
                        results.append(VideoResult(
                            title=v.get("title", ""),
                            url=v.get("url") or v.get("video_url", ""),
                            thumbnail=v.get("thumb") or v.get("thumbnail", ""),
                            duration=str(v.get("duration", "")),
                            site=self.site_name,
                            views=str(v.get("views", "")),
                            rating=str(v.get("rating", "")),
                        ))
            except Exception:
                break
        return results
