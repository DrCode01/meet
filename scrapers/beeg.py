import urllib.parse
import aiohttp
from .base import BaseScraper, VideoResult

# Beeg has an undocumented but stable JSON API
_API = "https://beeg.com/api/v6/index"


class BeegScraper(BaseScraper):
    site_name = "Beeg"
    base_url = "https://beeg.com"

    async def search(self, session: aiohttp.ClientSession, query: str) -> list[VideoResult]:
        results = []
        for offset in [0, 30]:
            params = {
                "q": query,
                "offset": str(offset),
                "step": "30",
                "order": "top_rated",
            }
            url = _API + "?" + urllib.parse.urlencode(params)
            try:
                async with session.get(
                    url,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "Accept": "application/json",
                        "Referer": "https://beeg.com/",
                    },
                    timeout=aiohttp.ClientTimeout(total=12),
                ) as resp:
                    if resp.status != 200:
                        break
                    data = await resp.json(content_type=None)
                    videos = data.get("videos") or data.get("results") or []
                    if not videos:
                        break
                    for v in videos:
                        vid_id = v.get("id", "")
                        title = v.get("title", "")
                        duration = str(v.get("duration", ""))
                        # Beeg thumbnail pattern
                        thumb = v.get("image") or v.get("thumb") or f"https://img.beeg.com/236x177/{vid_id}.jpg"
                        video_url = v.get("url") or f"{self.base_url}/{vid_id}"
                        if not title or not vid_id:
                            continue
                        results.append(VideoResult(
                            title=title,
                            url=video_url,
                            thumbnail=thumb,
                            duration=duration,
                            site=self.site_name,
                            views=str(v.get("views", "")),
                            rating=str(v.get("rate", "")),
                        ))
            except Exception:
                break
        return results
