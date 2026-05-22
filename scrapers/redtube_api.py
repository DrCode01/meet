import urllib.parse
import aiohttp
from .base import BaseScraper, VideoResult

# RedTube has a public JSON API at a separate domain — not blocked like www.redtube.com
_API = "https://api.redtube.com/"


class RedTubeApiScraper(BaseScraper):
    site_name = "RedTube"
    base_url = "https://www.redtube.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        results = []
        for page in [1, 2]:
            params = {
                "data": "redtube.Videos.searchVideos",
                "search": query,
                "output": "json",
                "thumbsize": "medium",
                "page": str(page),
                "limit": "30",
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
                    for item in videos:
                        v = item.get("video", item)
                        url_v = v.get("url") or f"{self.base_url}/{v.get('video_id', '')}"
                        thumb = v.get("thumb", "")
                        # pick highest res thumb available
                        thumbs = v.get("thumbs", [])
                        if thumbs:
                            thumb = thumbs[-1].get("src", thumb)
                        results.append(VideoResult(
                            title=v.get("title", ""),
                            url=url_v,
                            thumbnail=thumb,
                            duration=str(v.get("duration", "")),
                            site=self.site_name,
                            views=str(v.get("views", "")),
                            rating=str(v.get("rating", "")),
                        ))
            except Exception:
                break
        return results
